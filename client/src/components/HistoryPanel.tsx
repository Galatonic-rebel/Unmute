import { useTranslations } from '@/hooks/use-translations';
import { History, Clock, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

export function HistoryPanel() {
  const { data: translations, isLoading } = useTranslations();

  return (
    <div className="glass-panel rounded-3xl p-6 h-full flex flex-col max-h-[800px]">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-primary/20 rounded-xl text-primary">
          <History className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-display font-semibold">Past Sessions</h2>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-white/5 h-24 rounded-2xl" />
          ))
        ) : translations?.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4">
            <FileText className="w-12 h-12" />
            <p>No translation history yet.</p>
          </div>
        ) : (
          translations?.map((t, i) => (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              key={t.id}
              className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Clock className="w-3 h-3" />
                {format(new Date(t.createdAt), 'MMM d, h:mm a')}
              </div>
              <p className="text-sm text-foreground/90 line-clamp-3 leading-relaxed">
                "{t.originalText}"
              </p>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
