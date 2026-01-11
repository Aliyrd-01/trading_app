// src/components/HeroSection.jsx
import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

/*
  Самодостаточный Hero: встроенный SVG персонажа + 3 SVG-монеты (BTC/ETH/BNB).
  Монеты плавают по орбитам и крутятся. Персонаж немного "плавает".
  Не требует внешних картинок.
*/

const coinVariants = (delay = 0, orbit = 1) => ({
  initial: { opacity: 0, scale: 0.8 },
  animate: {
    opacity: [0.9, 1, 0.9],
    rotate: [0, 360],
    // y анимация для лёгкого "прыганья" по орбите
    // используем looped keyframes, duration зависит от orbit
    transition: {
      duration: 6 * orbit,
      delay,
      repeat: Infinity,
      ease: "linear",
    },
  },
});

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden py-16 md:py-28 bg-gradient-to-b from-[#0e0c22] to-[#24133a] text-white">
      <div className="container mx-auto px-6 grid md:grid-cols-2 items-center gap-8 relative z-10">
        {/* Текстовая часть */}
        <div className="space-y-6">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
            Cryptocurrency <span className="text-primary">Mining</span>
          </h1>

          <p className="text-gray-300 max-w-lg leading-relaxed">
            Два готовых продукта в одной платформе: глубокий анализ и мониторинг
            арбитража. Интерактивные отчёты, готовые стратегии и простой вход в работу.
          </p>

          <div className="flex flex-wrap gap-4 mt-6">
            <a
              href="#more"
              className="bg-primary text-black font-semibold px-6 py-3 rounded-md shadow hover:brightness-105 transition"
            >
              READ MORE
            </a>

            <Link
              to="/login"
              className="px-6 py-3 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 font-medium transition"
            >
              Login
            </Link>

            <Link
              to="/register"
              className="px-6 py-3 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 font-medium transition"
            >
              Register
            </Link>
          </div>
        </div>

        {/* Анимационная часть — SVG персонаж + монеты */}
        <div className="relative flex justify-center items-center">
          {/* орбитальные обводки (декор) */}
          <div className="absolute w-72 h-72 rounded-full border border-white/5 blur-sm opacity-30" />
          <div className="absolute w-52 h-52 rounded-full border border-white/3 opacity-20" />

          {/* Персонаж: SVG, немного плавает */}
          <motion.div
            initial={{ y: 8 }}
            animate={{ y: [-6, 0, -6] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="relative z-20"
            style={{ width: 260, height: 260 }}
          >
            {/* упрощённый авторский SVG персонажа */}
            <svg viewBox="0 0 320 320" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="g1" x1="0" x2="1">
                  <stop offset="0%" stopColor="#6ee7ff" />
                  <stop offset="100%" stopColor="#3fa9f5" />
                </linearGradient>
                <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#000" floodOpacity="0.35"/>
                </filter>
              </defs>

              {/* фон-овал (свет) */}
              <ellipse cx="160" cy="230" rx="110" ry="26" fill="#000" opacity="0.18" />

              {/* тело */}
              <g filter="url(#shadow)">
                <rect x="100" y="110" rx="28" ry="28" width="120" height="120" fill="#6b4f3b" />
                {/* галстук / рубашка */}
                <rect x="140" y="150" width="40" height="70" rx="6" fill="#fff" />
                <rect x="146" y="152" width="28" height="66" rx="4" fill="#f3b85b" />
                {/* голова */}
                <circle cx="160" cy="70" r="40" fill="#f7d9c3" />
                {/* очки */}
                <rect x="126" y="58" width="40" height="18" rx="6" fill="#0b1320" opacity="0.95" />
                <rect x="154" y="58" width="40" height="18" rx="6" fill="#0b1320" opacity="0.95" />
                <line x1="166" y1="67" x2="154" y2="67" stroke="#0b1320" strokeWidth="3" strokeLinecap="round"/>
                {/* ноги */}
                <rect x="120" y="220" width="26" height="44" rx="12" fill="#1f2937" />
                <rect x="174" y="220" width="26" height="44" rx="12" fill="#1f2937" />
                {/* руки вверх (праздничная поза) */}
                <path d="M100 125 C88 90, 72 70, 78 54" stroke="#f7d9c3" strokeWidth="12" strokeLinecap="round" fill="none"/>
                <path d="M220 125 C232 90, 248 70, 242 54" stroke="#f7d9c3" strokeWidth="12" strokeLinecap="round" fill="none"/>
              </g>
            </svg>
          </motion.div>

          {/* Монеты — три отдельные SVG, расположенные абсолютно и анимированные */}
          {/* BTC */}
          <motion.div
            className="absolute"
            style={{ left: "8%", top: "18%", width: 56, height: 56 }}
            variants={coinVariants(0, 0.9)}
            initial="initial"
            animate="animate"
          >
            <svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="btc" cx="30%" cy="20%">
                  <stop offset="0%" stopColor="#fffbcc"/>
                  <stop offset="100%" stopColor="#f5b301"/>
                </radialGradient>
              </defs>
              <circle cx="32" cy="32" r="30" fill="url(#btc)" stroke="#f2a900" strokeWidth="2"/>
              <text x="50%" y="56%" textAnchor="middle" fontSize="26" fontWeight="700" fill="#6b3400" fontFamily="Arial">฿</text>
            </svg>
          </motion.div>

          {/* ETH */}
          <motion.div
            className="absolute"
            style={{ left: "68%", top: "6%", width: 50, height: 50 }}
            variants={coinVariants(0.5, 1.2)}
            initial="initial"
            animate="animate"
          >
            <svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="eth" x1="0" x2="1">
                  <stop offset="0%" stopColor="#e6f0ff"/>
                  <stop offset="100%" stopColor="#9bb9ff"/>
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r="30" fill="#eaf1ff" stroke="#b6d0ff" strokeWidth="2"/>
              <g transform="translate(16,12)" fill="#2b4a7a">
                <path d="M16 0 L24 12 L8 12 Z" />
                <path d="M16 22 L24 10 L8 10 Z" opacity="0.9" />
              </g>
            </svg>
          </motion.div>

          {/* BNB */}
          <motion.div
            className="absolute"
            style={{ left: "54%", top: "58%", width: 48, height: 48 }}
            variants={coinVariants(1.0, 0.8)}
            initial="initial"
            animate="animate"
          >
            <svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="bnb" x1="0" x2="1">
                  <stop offset="0%" stopColor="#fff1cc"/>
                  <stop offset="100%" stopColor="#ffd24a"/>
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r="30" fill="url(#bnb)" stroke="#ffcc33" strokeWidth="2"/>
              <g transform="translate(16,16)" fill="#8a5a00">
                <rect x="8" y="0" width="8" height="8" rx="1" />
                <rect x="0" y="8" width="8" height="8" rx="1" />
                <rect x="16" y="8" width="8" height="8" rx="1" />
                <rect x="8" y="16" width="8" height="8" rx="1" />
              </g>
            </svg>
          </motion.div>

        </div>
      </div>

      {/* декоративные круги */}
      <div className="absolute w-96 h-96 bg-primary/10 rounded-full blur-3xl top-12 left-[-80px]" />
      <div className="absolute w-80 h-80 bg-primary/10 rounded-full blur-3xl bottom-8 right-[-80px]" />
    </section>
  );
}
