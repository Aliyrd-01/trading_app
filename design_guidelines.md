# Crypto Analyzer Landing Page - Design Guidelines

## Design Approach

**Reference-Based Approach**: Drawing inspiration from modern crypto platforms (Coinbase, Binance) and fintech leaders (Stripe, Revolut) with emphasis on dark themes, bold typography, and immersive 3D elements. The design balances professional credibility with creative playfulness through clay character integration.

## Core Design Principles

1. **Dark, Immersive Experience**: Deep backgrounds with strategic use of neon accents
2. **3D Visual Language**: Clay characters and crypto coins as hero elements
3. **Professional Credibility**: Clean layouts beneath the creative surface
4. **Clear Product Differentiation**: Distinct visual treatment for each product section

---

## Typography

**Primary Font**: Inter or Poppins (Google Fonts)
- Hero Headline: text-5xl/text-6xl/text-7xl, font-bold
- Section Headers: text-4xl/text-5xl, font-bold
- Product Titles: text-3xl/text-4xl, font-semibold
- Body Text: text-base/text-lg, font-normal
- Buttons/CTAs: text-sm/text-base, font-semibold

**Secondary Font**: JetBrains Mono (for numbers, metrics, code-like elements)

---

## Layout System

**Spacing Units**: Consistently use Tailwind units of 4, 6, 8, 12, 16, 20, 24, 32
- Section padding: py-20 lg:py-32
- Component spacing: gap-8, gap-12
- Container max-width: max-w-7xl
- Grid gaps: gap-6 to gap-12

**Grid System**: 
- Desktop: grid-cols-2 for product sections, grid-cols-3 for feature cards
- Tablet: grid-cols-2 maximum
- Mobile: grid-cols-1 always

---

## Page Structure & Sections

### 1. Hero Section (100vh)
**Layout**: Centered content with large headline, tagline, and three CTAs in a row
**Visual Treatment**: 
- Large 3D clay character interacting with floating crypto coins
- Gradient overlay effects
- Particle/grid background animation (subtle)

**Content Hierarchy**:
- Main headline: "Crypto Analyzer" or compelling value proposition
- Subheadline: Brief description of platform benefits
- Three primary CTAs: "Download App" (primary), "Demo Mode" (secondary), "Learn More" (tertiary)

### 2. Product Section 1: Trading Analyzer
**Layout**: Two-column asymmetric split (60/40 or 40/60)
- Left: Product mockup/visualization with clay character analyzing charts
- Right: Feature list with icons, headline, description

**Features to Highlight**:
- Real-time indicator analysis
- Entry/exit point detection
- Smart trade recommendations
- Historical performance tracking

### 3. Product Section 2: Arbitrage Trading Tool
**Layout**: Inverted two-column from Product 1 for visual variety
- Feature-rich card design showcasing arbitrage opportunities
- Clay character moving between platforms (visual metaphor)

**Features to Highlight**:
- Multi-exchange scanning
- Instant opportunity alerts
- Automated execution options
- Profit calculation

### 4. Social Proof/Stats Section
**Layout**: Three-column grid with animated counters
- Total trades analyzed
- Average profit increase
- Active users

**Visual**: Floating crypto coins and minimal clay characters as decorative elements

### 5. CTA Section
**Layout**: Centered, high-impact design
- Repeated primary CTAs with additional context
- "Ready to start trading smarter?"
- All three buttons prominently displayed

### 6. Footer
**Layout**: Three-column grid
- Column 1: Logo, brief tagline
- Column 2: Quick links (Products, Features, Demo)
- Column 3: Contact (Email icon + address, Telegram icon + link)

**Visual**: Dark background with subtle gradient, minimal decorative elements

---

## Component Library

### Navigation
- Fixed header with blur backdrop
- Logo (left), navigation links (center), "Download App" CTA (right)
- Mobile: Hamburger menu

### Buttons
**Primary CTA** (Download App):
- Prominent gradient background with blur effect when on images
- px-8 py-4, rounded-lg
- Bold font, larger text

**Secondary CTA** (Demo Mode):
- Outlined style with backdrop blur
- Same padding as primary

**Tertiary CTA** (Learn More):
- Text with arrow, subtle background

### Product Cards
- Rounded corners (rounded-2xl)
- Backdrop blur with semi-transparent dark background
- Padding: p-8 to p-12
- Subtle border with gradient hint

### Feature Icons
- Use Heroicons exclusively
- Size: w-8 h-8 to w-12 h-12
- Contained in circular backgrounds with gradient accents

---

## Images

**Required Images**:

1. **Hero Section**: 3D rendered clay character (plasticine style) sitting or standing with floating Bitcoin, Ethereum, and other crypto coins around them. Character should appear analytical/thoughtful. Place centrally or slightly offset with text.

2. **Trading Analyzer Section**: Clay character examining charts/graphs on a screen with magnifying glass. Crypto coins floating nearby. Dashboard mockup showing indicator analysis.

3. **Arbitrage Tool Section**: Clay character with multiple screens/platforms, moving coins between them. Visual representation of arbitrage concept.

4. **Decorative Elements**: Individual crypto coin renders (Bitcoin, Ethereum, USDT) to scatter throughout sections as floating elements.

**Image Treatment**: 
- All images should have a slight glow/neon edge effect
- Semi-transparent overlays where needed
- Maintain consistent clay/plasticine aesthetic throughout

---

## Animations

**Minimal, Strategic Use**:
- Hero: Gentle floating animation on clay character and coins
- Scroll-triggered: Fade-in and slide-up for sections (subtle, once per element)
- Stats counters: Count-up animation on scroll into view
- Buttons: Standard hover states only
- Background: Subtle animated gradient or particle field (very subtle)

**No**: Excessive parallax, constant motion, distracting effects

---

## Accessibility

- Maintain WCAG AA contrast ratios even on dark backgrounds
- All interactive elements have clear focus states
- Icon buttons include aria-labels
- Form inputs with proper labels
- Semantic HTML structure throughout

---

## Technical Notes

- Icons: Heroicons via CDN
- Fonts: Google Fonts (Inter/Poppins + JetBrains Mono)
- No custom SVG generation - use placeholders for clay characters
- Email/Telegram links functional in footer
- Mobile-first responsive approach