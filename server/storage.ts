import type { InsertProfile, Profile } from "@shared/schema";

// Storage interface minima de ejemplo; la app hoy usa Supabase directo en frontend.
export interface IStorage {
  getProfile(id: string): Promise<Profile | undefined>;
  getProfileByUsername(username: string): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  validateFile(fileName: string, fileSize: number): { valid: boolean; error?: string };
}

export class MemStorage implements IStorage {
  private profiles = new Map<string, Profile>();

  async getProfile(id: string): Promise<Profile | undefined> {
    return this.profiles.get(id);
  }

  async getProfileByUsername(username: string): Promise<Profile | undefined> {
    return Array.from(this.profiles.values()).find((profile) => profile.username === username);
  }

  async createProfile(insertProfile: InsertProfile): Promise<Profile> {
    const profile: Profile = {
      ...insertProfile,
      fullName: insertProfile.fullName ?? null,
      avatarUrl: insertProfile.avatarUrl ?? null,
      bio: insertProfile.bio ?? null,
      isPrivate: insertProfile.isPrivate ?? false,
      dailyLimitMinutes: insertProfile.dailyLimitMinutes ?? 90,
      quietHoursStart: insertProfile.quietHoursStart ?? null,
      quietHoursEnd: insertProfile.quietHoursEnd ?? null,
      searchVector: insertProfile.searchVector ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.profiles.set(profile.id, profile);
    return profile;
  }

  // Validación M12: Restricción de tipos y tamaños
  validateFile(fileName: string, fileSize: number): { valid: boolean; error?: string } {
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".mp4"];
    const maxFileSize = 10 * 1024 * 1024; // 10MB

    const ext = fileName.slice(((fileName.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase();
    if (!allowedExtensions.includes(`.${ext}`)) {
      return { valid: false, error: "Formato de archivo no permitido." };
    }

    if (fileSize > maxFileSize) {
      return { valid: false, error: "El archivo excede el tamaño máximo de 10MB." };
    }

    return { valid: true };
  }
}

export const storage = new MemStorage();
