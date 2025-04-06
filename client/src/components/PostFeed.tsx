import { useState } from 'react';
import { usePostStore } from '@/lib/postService';
import PostCard from './PostCard';
import { Glass } from './ui/glass';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { motion } from 'framer-motion';
import { RefreshCw, Filter } from 'lucide-react';

const PostFeed = () => {
  const { posts } = usePostStore();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filtrar publicaciones según la pestaña activa
  const filteredPosts = activeTab === 'all' 
    ? posts 
    : posts.filter(post => post.type === activeTab);
    
  // Simular refrescar feed
  const refreshFeed = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };
  
  return (
    <Glass className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Feed de InstaDetox</h2>
        <button 
          onClick={refreshFeed}
          className="p-2 hover:bg-gray-800 rounded-full transition-colors"
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList className="bg-gray-800/60">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="reflection">Reflexiones</TabsTrigger>
            <TabsTrigger value="quote">Citas</TabsTrigger>
            <TabsTrigger value="goal">Metas</TabsTrigger>
            <TabsTrigger value="milestone">Logros</TabsTrigger>
          </TabsList>
          
          <button className="p-2 bg-gray-800/60 rounded-full hover:bg-gray-700/80">
            <Filter className="h-4 w-4" />
          </button>
        </div>
        
        <TabsContent value="all" className="mt-0">
          {posts.length > 0 ? (
            <div>
              {posts.map(post => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div className="text-4xl mb-4">✨</div>
              <h3 className="text-xl font-medium mb-2">No hay publicaciones aún</h3>
              <p className="text-gray-400 mb-6 max-w-md">
                Comienza a compartir tus reflexiones, metas y logros en tu viaje de desintoxicación digital.
              </p>
              <a 
                href="/create" 
                className="px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-white transition-colors"
              >
                Crear mi primera publicación
              </a>
            </motion.div>
          )}
        </TabsContent>
        
        {['reflection', 'quote', 'goal', 'milestone'].map(type => (
          <TabsContent key={type} value={type} className="mt-0">
            {filteredPosts.length > 0 ? (
              <div>
                {filteredPosts.map(post => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-xl font-medium mb-2">No hay publicaciones de este tipo</h3>
                <p className="text-gray-400 mb-6 max-w-md">
                  Aún no has creado ninguna publicación de este tipo.
                </p>
                <a 
                  href="/create" 
                  className="px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-white transition-colors"
                >
                  Crear nueva publicación
                </a>
              </motion.div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </Glass>
  );
};

export default PostFeed;