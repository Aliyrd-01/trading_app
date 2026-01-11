import { createContext, useContext, useState, ReactNode } from 'react';
import DemoVideoModal from '@/components/DemoVideoModal';

interface DemoVideoContextType {
  openDemo: () => void;
  closeDemo: () => void;
  isOpen: boolean;
}

const DemoVideoContext = createContext<DemoVideoContextType | undefined>(undefined);

export function DemoVideoProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openDemo = () => setIsOpen(true);
  const closeDemo = () => setIsOpen(false);

  return (
    <DemoVideoContext.Provider value={{ openDemo, closeDemo, isOpen }}>
      {children}
      <DemoVideoModal isOpen={isOpen} onClose={closeDemo} />
    </DemoVideoContext.Provider>
  );
}

export function useDemoVideo() {
  const context = useContext(DemoVideoContext);
  if (!context) {
    throw new Error('useDemoVideo must be used within DemoVideoProvider');
  }
  return context;
}

