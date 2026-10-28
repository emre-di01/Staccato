// Globale Basis-Styles (Reset, Fokus, Animationen, Modal-Breakpoints) für alte und neue App-Hülle
export const GLOBAL_CSS = `        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { height: -webkit-fill-available; }

        .skip-link {
          position: absolute;
          top: -100px;
          left: 16px;
          z-index: 99999;
          padding: 10px 18px;
          background: var(--primary);
          color: var(--primary-fg);
          border-radius: var(--radius);
          font-weight: 700;
          font-size: 14px;
          text-decoration: none;
          transition: top 0.15s ease;
          white-space: nowrap;
        }
        .skip-link:focus { top: 12px; outline: 3px solid var(--primary); outline-offset: 2px; }
        body {
          background: var(--bg);
          color: var(--text);
          min-height: 100dvh;
          overscroll-behavior: none;
          -webkit-tap-highlight-color: transparent;
        }

        input, textarea, select {
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          touch-action: manipulation;
        }
        input:focus, textarea:focus, select:focus {
          outline: none !important;
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 20%, transparent) !important;
        }

        button {
          transition: all 0.15s ease;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        button:active:not(:disabled) { transform: scale(0.96) !important; }

        button:focus-visible,
        a:focus-visible,
        input:focus-visible,
        select:focus-visible,
        textarea:focus-visible {
          outline: 2px solid var(--primary) !important;
          outline-offset: 2px !important;
          box-shadow: none !important;
        }

        @media (hover: hover) {
          ::-webkit-scrollbar { width: 5px; height: 5px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: var(--text-3); }
        }

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideFromRight {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes slideFromLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes staggerIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .stagger-item { animation: staggerIn 0.22s ease both; }
        .stagger-item:nth-child(1)  { animation-delay: 0ms; }
        .stagger-item:nth-child(2)  { animation-delay: 50ms; }
        .stagger-item:nth-child(3)  { animation-delay: 100ms; }
        .stagger-item:nth-child(4)  { animation-delay: 150ms; }
        .stagger-item:nth-child(5)  { animation-delay: 200ms; }
        .stagger-item:nth-child(6)  { animation-delay: 250ms; }
        .stagger-item:nth-child(7)  { animation-delay: 300ms; }
        .stagger-item:nth-child(8)  { animation-delay: 350ms; }
        .stagger-item:nth-child(9)  { animation-delay: 400ms; }
        .stagger-item:nth-child(10) { animation-delay: 450ms; }
        .stagger-item:nth-child(11) { animation-delay: 500ms; }
        .stagger-item:nth-child(12) { animation-delay: 550ms; }

        html[data-transitioning] *,
        html[data-transitioning] *::before,
        html[data-transitioning] *::after {
          transition: background-color 0.35s ease, color 0.35s ease,
                      border-color 0.35s ease, box-shadow 0.35s ease !important;
        }

        @keyframes emptyBob {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-7px); }
        }
        @keyframes rsvpBounce {
          0%   { transform: scale(1); }
          35%  { transform: scale(1.18); }
          65%  { transform: scale(0.94); }
          100% { transform: scale(1); }
        }
        @keyframes ripple {
          from { transform: scale(0); opacity: 1; }
          to   { transform: scale(1); opacity: 0; }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: none; }
        }

        /* ── Hover Lift ── */
        .hover-lift {
          transition: transform 0.22s ease, box-shadow 0.22s ease !important;
          will-change: transform;
        }
        @media (hover: hover) {
          .hover-lift:hover {
            transform: translateY(-3px) !important;
            box-shadow: 0 10px 28px rgba(0,0,0,0.13) !important;
          }
        }
        .hover-lift:active { transform: translateY(-1px) !important; }

        /* ── Primary Button Shine ── */
        .btn-shine {
          position: relative;
          overflow: hidden;
        }
        .btn-shine::after {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent);
          transform: skewX(-20deg);
          transition: left 0.45s ease;
          pointer-events: none;
        }
        @media (hover: hover) {
          .btn-shine:hover::after { left: 160%; }
        }

        /* ── Nav Badge Pulse ── */
        @keyframes badgePulse {
          0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--danger) 65%, transparent); }
          70%  { box-shadow: 0 0 0 6px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
        .nav-badge { animation: badgePulse 2.2s ease infinite; }

        /* ── Scroll Fade-In ── */
        .fade-in-scroll {
          animation: fadeInScroll 0.45s cubic-bezier(0.4,0,0.2,1) both;
        }
        @keyframes fadeInScroll {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 640px) {
          .modal-overlay {
            align-items: flex-end !important;
            padding: 0 !important;
          }
          .modal-inner {
            border-radius: 20px 20px 0 0 !important;
            max-width: 100% !important;
            padding: 20px 16px 32px !important;
            max-height: 92dvh !important;
            border-left: none !important;
            border-right: none !important;
            border-bottom: none !important;
          }
          .kurs-modal-inner {
            border-radius: 20px 20px 0 0 !important;
            max-width: 100% !important;
            padding: 20px 16px 32px !important;
            max-height: 92dvh !important;
            border-left: none !important;
            border-right: none !important;
            border-bottom: none !important;
          }
        }

        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-header { display: flex !important; }
          .mobile-bottom-nav { display: flex !important; }
          .main-content {
            padding: 16px !important;
            padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px)) !important;
          }

          .mobile-nav-link[aria-current="page"]::before {
            content: '';
            position: absolute;
            top: 3px;
            left: 50%;
            transform: translateX(-50%);
            width: 20px;
            height: 3px;
            border-radius: 99px;
            background: var(--primary);
          }
        }

        @media (min-width: 769px) {
          .mobile-only { display: none !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
`
