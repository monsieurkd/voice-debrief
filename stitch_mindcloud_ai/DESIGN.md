---
name: Digital Sanctuary
colors:
  surface: '#f7f9ff'
  surface-dim: '#d6dae2'
  surface-bright: '#f7f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f4fc'
  surface-container: '#eaeef6'
  surface-container-high: '#e4e8f0'
  surface-container-highest: '#dee3eb'
  on-surface: '#171c22'
  on-surface-variant: '#44474a'
  inverse-surface: '#2c3137'
  inverse-on-surface: '#edf1f9'
  outline: '#74777b'
  outline-variant: '#c4c7ca'
  surface-tint: '#575f65'
  primary: '#575f65'
  on-primary: '#ffffff'
  primary-container: '#f0f8ff'
  on-primary-container: '#6a7278'
  inverse-primary: '#bfc8ce'
  secondary: '#53606a'
  on-secondary: '#ffffff'
  secondary-container: '#d6e4f0'
  on-secondary-container: '#596670'
  tertiary: '#4e6170'
  on-tertiary: '#ffffff'
  tertiary-container: '#f2f8ff'
  on-tertiary-container: '#607383'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe4ea'
  primary-fixed-dim: '#bfc8ce'
  on-primary-fixed: '#151d22'
  on-primary-fixed-variant: '#40484d'
  secondary-fixed: '#d6e4f0'
  secondary-fixed-dim: '#bac8d4'
  on-secondary-fixed: '#101d26'
  on-secondary-fixed-variant: '#3b4852'
  tertiary-fixed: '#d1e5f7'
  tertiary-fixed-dim: '#b5c9da'
  on-tertiary-fixed: '#091d2a'
  on-tertiary-fixed-variant: '#364957'
  background: '#f7f9ff'
  on-background: '#171c22'
  surface-variant: '#dee3eb'
  meditative-lavender: '#f3f1fb'
  sanctuary-white: '#fcfdff'
typography:
  headline-xl:
    fontFamily: Playwrite Deutschland Grundschrift
    fontSize: 44px
    fontWeight: '400'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Playwrite Deutschland Grundschrift
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.3'
  headline-lg-mobile:
    fontFamily: Playwrite Deutschland Grundschrift
    fontSize: 28px
    fontWeight: '400'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Open Sans
    fontSize: 19px
    fontWeight: '400'
    lineHeight: '1.8'
  body-md:
    fontFamily: Open Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.7'
  label-md:
    fontFamily: Open Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Open Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 920px
  gutter: 32px
  margin-mobile: 24px
  margin-desktop: 80px
  section-gap: 104px
---

## Brand & Style

The design system is a "Digital Sanctuary," a meditative environment meticulously engineered to lower cognitive load and foster deep, reflective thought. It targets a persona called "The Modern Thinker": researchers, writers, and creative strategists who require a workspace that feels like an organic extension of their mind.

The aesthetic is a refined blend of **Minimalism** and **Glassmorphism**. It emphasizes "Intentional Friction," where transitions are liquid and paced to match human contemplation. The interface evokes a sense of weightlessness and breathability, utilizing extreme whitespace and soft, translucent layers to create a sanctuary-like atmosphere that is both protective and expansive.

## Colors

The palette is rooted in a "Cognitive Calm" aesthetic, utilizing highly desaturated, luminous blues and soft atmospheric tints to reduce ocular strain.

- **Primary (Cloud Blue):** A soft, ethereal Alice Blue (#f0f8ff) used as the foundational canvas color to provide an airy, weightless base.
- **Secondary (Atmospheric Blue):** Used for subtle containment, such as sidebar backgrounds or grouped content areas.
- **Tertiary (Focus Blue):** A slightly more pigmented blue used for focus states and primary interactive cues.
- **Neutral (Calm Ink):** A deep, softened charcoal used for all typography to maintain softness while ensuring high legibility.

Gradients should be nearly imperceptible, mimicking the natural dissipation of light through a morning mist.

## Typography

This design system uses a dual-font approach to balance personality with extreme legibility. 

**Playwrite Deutschland Grundschrift** is used for headings and app titles. Its script-like, hand-crafted quality adds a humanistic touch to the "Digital Sanctuary," making the interface feel like a personal journal.

**Open Sans** is used for all body text and labels. To maintain the "Thinker" persona, line heights are intentionally generous (1.7 - 1.8), creating "visual oxygen" that prevents the dense "wall of text" effect. Vertical rhythm is prioritized over horizontal density.

## Layout & Spacing

The layout follows a **Fixed-Center Philosophy** to minimize ocular fatigue. Content is centered within a focused 920px container, mimicking the width of a physical journal or a well-set book page.

- **Extreme Whitespace:** Vertical gaps are used as structural elements to separate distinct mental models or insights.
- **The Frame:** Desktop margins are exceptionally wide (80px) to psychologically distance the workspace from the edges of the screen and OS distractions.
- **Fluid Adaptation:** On mobile, the frame collapses into safe-area margins (24px), but vertical padding remains high to ensure the interface never feels cramped.

## Elevation & Depth

Depth is conveyed through **Tonal Diffusion** and **Glassmorphism**, avoiding harsh dropshadows.

- **Atmospheric Layers:** Elements closer to the user (modals, active notes) shift toward a pure Sanctuary White and gain a more pronounced backdrop blur.
- **Glassmorphism:** Navigation and secondary utility panels use a high-refraction blur (24px) with a subtle 1px stroke at 40% white. This allows the primary Cloud Blue to bleed through, maintaining environmental unity.
- **Shadow Philosophy:** Shadows are "Ambient Tints." Instead of gray, they use a semi-transparent version of the primary blue color, creating a soft glow that makes elements appear to float on a cushion of air.

## Shapes

The shape language is organic and approachable, designed to eliminate "visual sharpness." 

Standard components use **Rounded** (0.5rem) corners. Persistent surfaces, such as cards and sidebars, utilize **Rounded-XL** (1.5rem) to reinforce the soft, sanctuary-like feel. High-touch interactive elements like chips and primary buttons may utilize pill-shapes (rounded-full) to signify touchability.

## Components

- **Buttons:** Designed as pill-shapes with generous horizontal padding. Primary buttons use a subtle tonal shift; secondary buttons are glassmorphic with a blur.
- **Ambient Inputs:** Text inputs have no borders or background fills by default to remove the pressure of "filling forms." Upon focus, a delicate, low-opacity blue glow appears around the active area.
- **Floating Cards:** Used for insights or mapping. These use the signature ambient shadow and a 1.5rem corner radius to appear as if drifting above the workspace floor.
- **Chips:** Small, rounded markers in `meditative-lavender` for non-intrusive tagging.
- **The Sanctuary Sidebar:** A persistent glassmorphic panel housing high-level navigation. It uses a high-blur factor to stay present but unobtrusive.
- **Ghost Loaders:** Instead of spinning icons, use subtle "pulsing" lines that mimic a breathing pattern during processing.
