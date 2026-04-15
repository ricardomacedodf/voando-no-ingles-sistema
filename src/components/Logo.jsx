import { Link } from 'react-router-dom';

export default function Logo({ compact = false }) {
  return (
    <Link to="/" className={`flex items-center gap-3 ${compact ? '' : 'px-2'} hover:opacity-80 transition-opacity`}>
      {/* Logo icon - outline airplane + USA flag */}
      <div className="relative w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Airplane outline */}
          <path d="M22 4L14 22L11 14L3 11L22 4Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" fill="none"/>
          <line x1="11" y1="14" x2="22" y2="4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          {/* USA flag stripes (outline) */}
          <line x1="3" y1="17" x2="8" y2="15.5" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.7"/>
          <line x1="3" y1="19.5" x2="7" y2="18.2" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.7"/>
          <line x1="3" y1="22" x2="6" y2="21" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.7"/>
          {/* Stars */}
          <path d="M6 7 L6.4 8.2 L7.7 8.2 L6.65 8.95 L7.05 10.15 L6 9.4 L4.95 10.15 L5.35 8.95 L4.3 8.2 L5.6 8.2 Z" stroke="white" strokeWidth="0.5" fill="none" opacity="0.8"/>
          <path d="M9.5 5 L9.8 5.9 L10.7 5.9 L10 6.45 L10.3 7.35 L9.5 6.8 L8.7 7.35 L9 6.45 L8.3 5.9 L9.2 5.9 Z" stroke="white" strokeWidth="0.4" fill="none" opacity="0.7"/>
        </svg>
      </div>
      {!compact && (
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-foreground leading-tight tracking-tight">
            Voando no Inglês
          </span>
          <span className="text-[11px] text-muted-foreground font-medium leading-tight">
            Teacher Ricardo
          </span>
        </div>
      )}
    </Link>
  );
}