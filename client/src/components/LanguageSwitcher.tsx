import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/lib/i18n';
import { Globe } from 'lucide-react';

// SVG компоненты для флагов
const UKFlag = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg">
    <rect width="60" height="30" fill="#012169"/>
    <path d="M0 0l60 30M60 0L0 30" stroke="#fff" strokeWidth="2.5"/>
    <path d="M0 0l60 30M60 0L0 30" stroke="#C8102E" strokeWidth="1.5"/>
    <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="5"/>
    <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="3"/>
  </svg>
);

const UkraineFlag = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
    <g fillRule="evenodd" strokeWidth="1pt">
      <path fill="#ffd700" d="M0 0h640v240H0z"/>
      <path fill="#0057b8" d="M0 240h640v240H0z"/>
    </g>
  </svg>
);

const RussiaFlag = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
    <g fillRule="evenodd" strokeWidth="1pt">
      <path fill="#fff" d="M0 0h640v160H0z"/>
      <path fill="#0039a6" d="M0 160h640v160H0z"/>
      <path fill="#d52b1e" d="M0 320h640v160H0z"/>
    </g>
  </svg>
);

const languages = [
  { code: 'en' as const, name: 'English', Flag: UKFlag },
  { code: 'uk' as const, name: 'Українська', Flag: UkraineFlag },
  { code: 'ru' as const, name: 'Русский', Flag: RussiaFlag },
];

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-language">
          <Globe className="h-5 w-5" />
          <span className="sr-only">Switch language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => {
          const FlagIcon = lang.Flag;
          return (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className="gap-2"
              data-testid={`language-${lang.code}`}
            >
              <FlagIcon className="w-5 h-4 rounded-sm" />
              <span>{lang.name}</span>
              {language === lang.code && (
                <span className="ml-auto text-primary">✓</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
