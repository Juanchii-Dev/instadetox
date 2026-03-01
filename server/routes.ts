import type { Express } from "express";
import { createServer, type Server } from "http";
import { supabaseAdmin, requireAuth, type AuthenticatedRequest } from "./supabase";
import { insertCommentSchema } from "./schemas/apiContracts";
import rateLimit from "express-rate-limit";
import { log } from "./logger";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // -- OBSERVABILITY & HEALTH (Enterprise M12) --

  const metricsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 50, // Límite estricto para evitar spam de telemetría
    message: { error: "Too many metrics requests" }
  });

  app.get("/api/health", (_req, res) => {
    return res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  app.get("/api/health/deep", async (_req, res) => {
    const start = Date.now();
    const timeout = 3000; // 3s Timeout
    
    try {
      // Race entre la query de la DB y un timeout controlado
      const dbCheck = Promise.race([
        supabaseAdmin.from("profiles").select("count").limit(1).then(r => r.error ? Promise.reject(r.error) : "ok"),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Database timeout")), timeout))
      ]);

      await dbCheck;

      return res.json({
        status: "ok",
        engine: "Instadetox Express Proxy",
        version: process.env.npm_package_version || "1.0.0",
        env: process.env.NODE_ENV || "development",
        db: "connected",
        latency: `${Date.now() - start}ms`
      });
    } catch (err) {
      log(`Deep Health Check failed: ${err instanceof Error ? err.message : String(err)}`, "error", "health");
      return res.status(503).json({
        status: "down",
        db: "disconnected",
        error: err instanceof Error ? err.message : "Persistence layer unavailable"
      });
    }
  });

  app.post("/api/metrics/performance", metricsLimiter, (req, res) => {
    const { metric, value, route } = req.body;
    if (!metric || value === undefined) {
      log(`Invalid metrics payload: ${JSON.stringify(req.body)}`, "warn", "telemetry");
      return res.status(400).json({ error: "Invalid metrics payload" });
    }

    log(`Metric Capture: ${metric}=${value} for ${route || "unknown"}`, "info", "telemetry");
    return res.status(202).end(); // Accepted
  });

  // -- APP ROUTES --

  // Importamos los limitadores específicos si fuera necesario, 
  // pero ya están definidos globalmente o se pueden pasar desde app.
  // Para ser explícitos en routes.ts bajo M12:
  const socialLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 20,
    message: { error: "Acción social bloqueada por límite de frecuencia." }
  });

  app.post("/api/posts/:id/like", requireAuth, socialLimiter, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const postId = req.params.id;

    if (!postId) return res.status(400).json({ error: "Missing post ID" });

    // 1. Get the post owner
    const { data: post, error: postErr } = await req.userSupabase!
      .from("posts")
      .select("user_id")
      .eq("id", postId)
      .single();

    if (postErr || !post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // 2. Insert the like
    const { error: likeErr } = await req.userSupabase!
      .from("post_likes")
      .upsert({ post_id: postId, user_id: userId }, { onConflict: "post_id,user_id", ignoreDuplicates: true });

    if (likeErr) {
      return res.status(500).json({ error: "Could not create like" });
    }

    // 2.1 Update likes_count in posts table (M12 SSOT consistency)
    const { error: rpcErr } = await req.userSupabase!.rpc('increment_likes_count', { p_post_id: postId });
    if (rpcErr) {
      // Fallback: Increment directly if RPC is missing
      const { data: currPost } = await req.userSupabase!.from("posts").select("likes_count").eq("id", postId).single();
      if (currPost) {
        await req.userSupabase!.from("posts").update({ likes_count: (currPost.likes_count || 0) + 1 }).eq("id", postId);
      }
    }

    // 3. Create Notification if it's not our own post
    if (post.user_id !== userId) {
      await supabaseAdmin.from("notifications").insert({
        user_id: post.user_id,
        actor_id: userId,
        post_id: postId,
        type: "like",
        title: "Nuevo me gusta",
      });
    }

    return res.json({ success: true });
  });

  // DELETE /api/posts/:id/like
  app.delete("/api/posts/:id/like", requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const postId = req.params.id;

    if (!postId) return res.status(400).json({ error: "Missing post ID" });

    // Remove the like
    const { error: likeErr } = await req.userSupabase!
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);

    if (likeErr) {
      return res.status(500).json({ error: "Could not remove like" });
    }

    // Sync likes_count
    const { error: rpcErr2 } = await req.userSupabase!.rpc('decrement_likes_count', { p_post_id: postId });
    if (rpcErr2) {
      const { data: currPost } = await req.userSupabase!.from("posts").select("likes_count").eq("id", postId).single();
      if (currPost) {
        await req.userSupabase!.from("posts").update({ likes_count: Math.max(0, (currPost.likes_count || 0) - 1) }).eq("id", postId);
      }
    }

    return res.json({ success: true });
  });

  // POST /api/posts/:id/comment
  app.post("/api/posts/:id/comment", requireAuth, socialLimiter, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const postId = req.params.id;

    if (!postId) return res.status(400).json({ error: "Missing post ID" });

    const parsedBody = insertCommentSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parsedBody.error.errors 
      });
    }

    const { content, parent_id, client_id } = parsedBody.data;

    // 1. Check if comments are enabled and get owner
    const { data: post, error: postErr } = await req.userSupabase!
      .from("posts")
      .select("user_id, comments_enabled")
      .eq("id", postId)
      .single();

    if (postErr || !post) return res.status(404).json({ error: "Post not found" });
    if (post.comments_enabled === false) return res.status(403).json({ error: "Comments disabled for this post" });

    // 2. Insert Comment
    const { data: commentUrl, error: commentErr } = await req.userSupabase!
      .from("post_comments")
      .insert({
        id: client_id || undefined, // use client generated UUID if provided
        post_id: postId,
        user_id: userId,
        parent_id: parent_id || null,
        content: content,
      })
      .select("id, user_id, parent_id, content, created_at")
      .single();

    if (commentErr || !commentUrl) {
      return res.status(500).json({ error: "Could not post comment" });
    }

    // 3. Notify owner (and eventually parent if reply)
    if (post.user_id !== userId) {
      await supabaseAdmin.from("notifications").insert({
        user_id: post.user_id,
        actor_id: userId,
        post_id: postId,
        type: "comment",
        title: "Nuevo comentario",
        body: content.slice(0, 50) + (content.length > 50 ? "..." : ""),
      });
    }

    return res.json({ success: true, data: commentUrl });
  });

  // POST /api/users/:id/follow
  app.post("/api/users/:id/follow", requireAuth, socialLimiter, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const targetId = req.params.id;

    if (!targetId || userId === targetId) return res.status(400).json({ error: "Invalid target user" });

    // 1. Get target visibility
    const { data: targetProfile, error: targetErr } = await req.userSupabase!
      .from("profiles")
      .select("is_private")
      .eq("id", targetId)
      .single();

    if (targetErr || !targetProfile) return res.status(404).json({ error: "User not found" });

    let isRequest = false;

    if (targetProfile.is_private) {
      isRequest = true;
      const { error } = await req.userSupabase!.from("follow_requests").upsert(
        { requester_id: userId, target_id: targetId, status: "pending", resolved_at: null },
        { onConflict: "requester_id,target_id" }
      );
      if (error) return res.status(500).json({ error: "Could not send follow request" });
    } else {
      const { error } = await req.userSupabase!
        .from("follows")
        .insert({ follower_id: userId, following_id: targetId });
      if (error) return res.status(500).json({ error: "Could not follow user" });
    }

    // 3. Send Notification
    await supabaseAdmin.from("notifications").insert({
      user_id: targetId,
      actor_id: userId,
      type: "follow",
      title: isRequest ? "Solicitud de seguimiento" : "Nuevo seguidor",
    });

    return res.json({ success: true, isRequest });
  });

  // DELETE /api/users/:id/follow
  app.delete("/api/users/:id/follow", requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const targetId = req.params.id;

    if (!targetId) return res.status(400).json({ error: "Invalid target user" });

    // Delete relation (could be follow or request)
    await Promise.all([
      req.userSupabase!.from("follows").delete().eq("follower_id", userId).eq("following_id", targetId),
      req.userSupabase!.from("follow_requests").delete().eq("requester_id", userId).eq("target_id", targetId).eq("status", "pending")
    ]);

    return res.json({ success: true });
  });

  const httpServer = createServer(app);
  return httpServer;
}
