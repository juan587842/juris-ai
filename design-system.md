# Design System — Juris AI

> **Versão:** 1.0  
> **Projeto de origem:** Juris AI CRM Jurídico  
> **Conceito visual:** Dark mode profissional, Legal Design, glassmorphism sutil com acentos dourados.  
> **Stack:** Next.js · TailwindCSS · Lucide React · Inter (Google Fonts)

---

## 1. Princípios de Design

| Princípio | Descrição |
|-----------|-----------|
| **Legal Design** | Interfaces limpas que reduzem carga cognitiva. Hierarquia visual clara para contextos de trabalho intenso. |
| **Dark-first** | Dark mode como modo padrão; tons navy/slate evitando preto puro. |
| **Zonas de Urgência** | Destaque visual explícito para prazos fatais (vermelho) e alertas críticos. |
| **Glassmorphism Sutil** | `backdrop-filter: blur` com bordas translúcidas em superfícies elevadas. |
| **Micro-animações** | Transições de 150–300 ms para hover, abertura de modais e troca de abas. |
| **F-Pattern Layout** | Conteúdo principal seguindo o padrão de leitura natural em dashboards. |

---

## 2. Tokens de Cor

### CSS Custom Properties (`:root`)

```css
:root {
  color-scheme: dark;

  /* Backgrounds */
  --color-background:        #0a0f1e;   /* fundo da página */
  --color-surface:           #111827;   /* cards e painéis */
  --color-surface-elevated:  #1a2235;   /* modais, dropdowns */

  /* Brand / Primary */
  --color-primary:           #c9a96e;   /* Gold — acento principal */
  --color-primary-light:     #e6c487;   /* Gold mais claro (hover) */

  /* Texto */
  --color-secondary:         #c2d0e4;   /* texto padrão */
  --color-tertiary:          #b8c8f2;   /* texto auxiliar/links fracos */

  /* Semântico */
  --color-error:             #ffb4ab;

  /* Bordas */
  --color-border:            rgba(201, 169, 110, 0.08);

  /* Radii */
  --radius-md:               8px;
  --radius-lg:               12px;
}
```

### Tailwind config equivalente

```js
// tailwind.config.js
theme: {
  extend: {
    colors: {
      background:        '#0a0f1e',
      surface:           '#111827',
      'surface-elevated': '#1a2235',
      primary:           '#c9a96e',
      'primary-light':   '#e6c487',
      secondary:         '#c2d0e4',
      tertiary:          '#b8c8f2',
      error:             '#ffb4ab',
    },
    borderRadius: {
      md: '8px',
      lg: '12px',
      xl: '16px',
      '2xl': '20px',
    },
  },
},
```

### Paleta de Status (usado em badges e bordas de cards)

| Semântica | Cor | Uso |
|-----------|-----|-----|
| Sucesso / Ativo | `#22c55e` (green-500) | Casos em andamento, pagos |
| Atenção | `#eab308` (yellow-500) | Aguardando, pendentes, HITL |
| Urgente | `#ef4444` (red-500) | Prazos fatais, vencidos |
| Info | `#3b82f6` (blue-500) | Em andamento, eventos |
| Premium | `#c9a96e` (gold) | Alvarás, destaques VIP |
| Neutro | `#6b7280` (gray-500) | Arquivados, ex-clientes |

---

## 3. Tipografia

**Font family:** `Inter` (Google Fonts)

```html
<!-- No <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
```

```css
body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}
```

### Escala Tipográfica

| Nome | Tamanho | Peso | Uso |
|------|---------|------|-----|
| `display` | 32–40px | 800 | Headings de página hero |
| `heading-xl` | 28px | 700 | Títulos de seção principal |
| `heading-lg` | 22–24px | 700 | Títulos de card / modal |
| `heading-md` | 18–20px | 600 | Subtítulos |
| `body-lg` | 16px | 400 | Parágrafos principais |
| `body-md` | 14px | 400 | Texto padrão de tabelas e cards |
| `body-sm` | 13px | 400 | Metadados, timestamps |
| `label` | 10–11px | 600 | Labels de input (uppercase, letter-spacing) |
| `mono` | 13–14px | 400 | Números de processo, códigos |

```css
/* Labels de input — padrão do projeto */
label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-primary); /* opacity 70% */
}
```

---

## 4. Espaçamento e Grid

```
Base unit: 4px (0.25rem)

Escala:
  1  →  4px
  2  →  8px
  3  → 12px
  4  → 16px
  5  → 20px
  6  → 24px
  8  → 32px
  10 → 40px
  12 → 48px
```

**Layout Desktop (1440px):**
- Sidebar: `240px` (colapsável até `64px`)
- Content area: `flex-1`
- Right panel (detalhes): `280px`

**Breakpoints:**
```
sm:  640px
md:  768px
lg:  1024px
xl:  1280px
2xl: 1440px+
```

---

## 5. Componentes Base

### 5.1 Card Glassmorphism

```css
.card {
  background: linear-gradient(
    135deg,
    rgba(17, 24, 39, 0.8),
    rgba(26, 34, 53, 0.6)
  );
  border: 1px solid rgba(201, 169, 110, 0.06);
  border-radius: var(--radius-lg); /* 12px */
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

/* Hover state */
.card:hover {
  border-color: rgba(201, 169, 110, 0.15);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  transition: all 200ms ease;
}
```

**Tailwind equivalente:**
```
bg-surface/80 border border-primary/[0.06] rounded-xl md:rounded-2xl
backdrop-blur-md hover:border-primary/20 hover:shadow-2xl transition-all duration-200
```

### 5.2 Botão Primary (Gold)

```jsx
// Botão padrão de ação principal
<button className="
  px-6 py-2.5
  bg-primary text-background
  rounded-xl font-bold text-sm
  hover:bg-primary-light
  transition-all duration-150
  disabled:opacity-50
">
  Confirmar
</button>
```

| Variante | Classes |
|----------|---------|
| Primary | `bg-primary text-background hover:bg-primary-light` |
| Outline | `border border-primary/40 text-primary hover:border-primary/70 hover:bg-primary/5` |
| Ghost | `text-secondary/70 hover:text-primary transition-colors` |
| Danger | `bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20` |
| Icon | `p-2 rounded-full bg-surface-elevated hover:bg-white/5` |

### 5.3 Input / Campo de Entrada

```jsx
<div>
  <label className="block text-[10px] font-semibold uppercase tracking-widest text-primary/70 mb-2">
    Título do Campo *
  </label>
  <div className="relative">
    <Icon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/40" />
    <input
      type="text"
      placeholder="Placeholder..."
      className="
        w-full bg-surface-elevated border border-primary/20
        text-secondary text-sm
        rounded-xl pl-10 pr-4 py-3
        outline-none focus:border-primary/50
        placeholder:text-secondary/30
        transition-colors
      "
    />
  </div>
</div>
```

**Textarea:**
```jsx
<textarea
  rows={3}
  className="
    w-full bg-surface-elevated border border-primary/20
    text-secondary text-sm
    rounded-xl pl-10 pr-4 py-3
    outline-none focus:border-primary/50
    resize-none transition-colors
  "
/>
```

### 5.4 Badge / Pill de Status

```jsx
// Padrão de badges semânticos
const statusBadge = {
  active:   "bg-green-500/10 text-green-400 border border-green-500/20",
  pending:  "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  urgent:   "bg-red-500/10 text-red-400 border border-red-500/20",
  info:     "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  gold:     "bg-primary/10 text-primary border border-primary/20",
  neutral:  "bg-white/5 text-secondary/60 border border-white/10",
};

<span className={`
  px-2.5 py-1 rounded-full text-xs font-semibold
  ${statusBadge.active}
`}>
  Em andamento
</span>
```

### 5.5 Modal

```jsx
// Overlay + contentor do modal
<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
  <div
    className="bg-surface border border-primary/20 p-8 rounded-2xl w-full max-w-lg shadow-2xl relative"
    onClick={(e) => e.stopPropagation()}
  >
    {/* Botão fechar */}
    <button
      onClick={onClose}
      className="absolute right-6 top-6 text-secondary/40 hover:text-secondary bg-surface-elevated hover:bg-white/5 p-2 rounded-full transition-colors"
    >
      <X size={20} />
    </button>

    {/* Header */}
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-secondary mb-2">Título do Modal</h2>
      <p className="text-secondary/50 text-sm">Descrição curta e objetiva da ação.</p>
    </div>

    {/* Conteúdo */}
    <div className="space-y-5">
      {/* campos aqui */}
    </div>

    {/* Footer de ações */}
    <div className="flex items-center justify-end gap-3 mt-10">
      <button onClick={onClose} className="px-6 py-2.5 text-sm font-medium text-secondary/70 hover:text-primary transition-colors">
        Cancelar
      </button>
      <button className="flex items-center justify-center px-8 py-2.5 bg-primary text-background rounded-xl font-bold hover:bg-primary-light transition-all min-w-[150px]">
        Confirmar
      </button>
    </div>
  </div>
</div>
```

### 5.6 Sidebar Nav Item

```jsx
// Item de navegação ativo vs inativo
<Link
  href={href}
  className={`
    flex items-center gap-3 py-2 px-3 rounded-lg
    transition-all duration-200 text-sm
    ${active
      ? "bg-primary/[0.08] text-primary font-medium"
      : "text-secondary/60 hover:text-secondary/90 hover:bg-white/[0.02]"
    }
  `}
>
  <div className={`flex-shrink-0 ${active ? "text-primary" : "text-secondary/40"}`}>
    {icon}
  </div>
  <span className="truncate">{text}</span>
</Link>
```

**Section label da sidebar:**
```jsx
<div className="mt-6 mb-2 px-3 text-[10px] font-semibold text-primary/40 uppercase tracking-widest">
  Inteligência
</div>
```

### 5.7 Scrollbar Custom

```css
::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(201, 169, 110, 0.15);
  border-radius: 999px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(201, 169, 110, 0.3);
}

/* Utilitário para esconder scrollbar */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
```

### 5.8 Focus Ring Custom

```css
*:focus-visible {
  outline: 1px solid var(--color-primary);
  outline-offset: 2px;
}
```

---

## 6. Padrões de Layout

### 6.1 Layout Principal (Dashboard Shell)

```
┌─────────────────────────────────────────────────┐
│ SIDEBAR (240px)  │  TOP BAR (h-16 / 64px)       │
│                  │─────────────────────────────  │
│  Logo            │  MAIN CONTENT (flex-1)        │
│  Nav items       │                               │
│  ─────────       │  ROW 1: Zona de Urgência     │
│  Inteligência    │  ROW 2: Cards 2-col          │
│  ─────────       │  ROW 3: Cards 2-col          │
│  Gestão          │                               │
│                  │                               │
│  User avatar     │                               │
└──────────────────┴───────────────────────────────┘
```

### 6.2 Layout de Detalhe (3 painéis)

```
┌─────────────┬──────────────────────┬────────────┐
│ Lista (320) │   Conteúdo (flex-1)  │ Info (280) │
│             │                      │            │
│  Filtros    │   Header + Tabs      │  Contato   │
│  Items      │   Timeline / Form    │  Tags      │
│             │   Messages           │  Notas     │
│             │   [Input area]       │            │
└─────────────┴──────────────────────┴────────────┘
```

### 6.3 Grid de Cards

```jsx
// 4 colunas — stat cards
<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

// 3 colunas — skill/feature cards
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// 2 colunas — painéis iguais
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
```

---

## 7. Animações e Transições

### Princípios

- **Duração curta:** 150–300 ms para interações de UI
- **Easing:** `ease-in-out` ou `ease` (evite `linear`)
- **Escopo:** Hover, abertura de modal, troca de tab

### Classes Tailwind Recomendadas

```
transition-all duration-200        → padrão de hover em cards/botões
transition-colors duration-150     → mudança de cor em links/nav
animate-in fade-in duration-200    → entrada de modais e overlays
```

### Animação de modal (CSS puro)

```css
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}

.modal-enter {
  animation: fadeIn 200ms ease forwards;
}
```

### Skeleton Loading

```jsx
// Placeholder de loading
<div className="animate-pulse rounded-xl bg-surface-elevated h-24 w-full" />

// Barra de texto
<div className="animate-pulse rounded h-4 bg-surface-elevated w-3/4" />
```

---

## 8. Ícones

**Biblioteca:** [Lucide React](https://lucide.dev/)

```bash
npm install lucide-react
```

**Tamanhos padrão:**
| Contexto | Tamanho |
|----------|---------|
| Sidebar / nav | `size={18}` |
| Input leading icon | `size={18}` |
| Botão de ação | `size={16}` |
| Badge / chip | `size={12}` |
| Estado vazio / hero | `size={48}` |

**Ícones mais usados no projeto:**

```jsx
import {
  LayoutDashboard, Briefcase, Users, Inbox, CalendarDays,
  DollarSign, BrainCircuit, Sparkles, Settings, ShieldCheck,
  BookOpen, FileText, Cpu, Loader2, X, Calendar, Clock,
  ChevronDown, ChevronRight, Search, Plus, Bell, LogOut,
  MessageSquare, Phone, Mail, Edit, Trash2, MoreHorizontal,
  AlertTriangle, CheckCircle, Clock4, ArrowUpRight,
} from "lucide-react";
```

---

## 9. Acessibilidade

| Regra | Implementação |
|-------|--------------|
| Contraste mínimo AA | Gold `#c9a96e` sobre navy `#0a0f1e` ≈ 5.2:1 ✅ |
| Focus ring | 1px solid `--color-primary`, offset 2px |
| `aria-label` | Todos os botões icon-only devem ter `aria-label` |
| `role="dialog"` | Todos os modais |
| `lang` | `<html lang="pt-BR">` |
| Títulos únicos | Uma única `<h1>` por página |

---

## 10. globals.css (arquivo completo)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
  --color-background:       #0a0f1e;
  --color-surface:          #111827;
  --color-surface-elevated: #1a2235;
  --color-primary:          #c9a96e;
  --color-primary-light:    #e6c487;
  --color-secondary:        #c2d0e4;
  --color-tertiary:         #b8c8f2;
  --color-error:            #ffb4ab;
  --color-border:           rgba(201, 169, 110, 0.08);
  --radius-md:              8px;
  --radius-lg:              12px;
}

* {
  border-color: var(--color-border);
}

body {
  background-color: var(--color-background);
  color: var(--color-secondary);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

*:focus-visible {
  outline: 1px solid var(--color-primary);
  outline-offset: 2px;
}

.card {
  background: linear-gradient(135deg, rgba(17,24,39,0.8), rgba(26,34,53,0.6));
  border: 1px solid rgba(201,169,110,0.06);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(8px);
}

::-webkit-scrollbar        { width: 4px; height: 4px; }
::-webkit-scrollbar-track  { background: transparent; }
::-webkit-scrollbar-thumb  { background: rgba(201,169,110,0.15); border-radius: 999px; }
::-webkit-scrollbar-thumb:hover { background: rgba(201,169,110,0.3); }

.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
```

---

## 11. tailwind.config.ts (completo)

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background:               '#0a0f1e',
        surface:                  '#111827',
        'surface-elevated':       '#1a2235',
        'surface-container':      '#1a2235',
        'surface-container-highest': '#222d42',
        primary:                  '#c9a96e',
        'primary-light':          '#e6c487',
        secondary:                '#c2d0e4',
        tertiary:                 '#b8c8f2',
        error:                    '#ffb4ab',
        'on-surface':             '#e2e8f0',
        outline:                  '#6b7280',
      },
      fontFamily: {
        sans:     ['Inter', 'system-ui', 'sans-serif'],
        headline: ['Inter', 'system-ui', 'sans-serif'],
        mono:     ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      borderRadius: {
        md:   '8px',
        lg:   '12px',
        xl:   '16px',
        '2xl':'20px',
      },
      boxShadow: {
        'glow-gold': '0 0 20px rgba(201, 169, 110, 0.15)',
        'glow-sm':   '0 0 10px rgba(201, 169, 110, 0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease forwards',
        'slide-up': 'slideUp 250ms ease forwards',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## 12. Prompt de Design para IA (Stitch / v0 / etc.)

Use este prompt base ao gerar novas telas que sigam este design system:

```
Design a premium dark-mode UI screen for [app name].

Visual Style:
- Background: deep navy #0a0f1e with subtle radial gradient
- Surface/cards: #111827 with glassmorphism (rgba overlay + backdrop-blur)
- Primary accent: gold #C9A96E (buttons, active states, headings)
- Text: light slate #c2d0e4 for body, white for headings
- Font: Inter (400/500/600/700)
- Borders: rgba(201,169,110,0.08) — very subtle gold tint
- Corner radius: 12–16px for cards, 8px for inputs, 999px for badges/pills
- Micro-animations: 200ms ease transitions on hover

Status colors:
- Green (#22c55e) → success/active
- Yellow (#eab308) → warning/pending
- Red (#ef4444) → urgent/error
- Blue (#3b82f6) → informational
- Gold (#c9a96e) → featured/VIP

Layout: [descreva o layout desejado aqui]

Components to include: [liste os componentes]

Desktop 1440px wide. No device frames.
```

---

## 13. Referências e Stitch IDs

| Recurso | Valor |
|---------|-------|
| **Stitch Project ID** | `11024249112873092193` |
| **Font** | Inter (Google Fonts) |
| **Icon Library** | Lucide React |
| **Component Library** | Custom (sem shadcn/ui) |
| **CSS Framework** | TailwindCSS v3 |

### Telas de referência (Stitch Screen IDs)

| Tela | ID |
|------|----|
| Login | `fd72f944348c4cdf9dea4d6d69951705` |
| Dashboard | `66d6b43b1f03461592d03732ee6de958` |
| Casos (lista) | `4f434de6b8a743e9ad4971cfaf8b95da` |
| Caso individual | `f3ac958e1eae4a168bb2a31c980ad51b` |
| Contatos | `9b53be3d016c41798b643de44869cdf1` |
| Inbox | `4f771e7bc716473f803887abe318294e` |
| Calendário | `f384ccb29db843aa91f1d53f92a56323` |
| Financeiro | `b7e35fe0cc8442d0a3d8e8274629cd18` |
| IA & Skills | `6aa9cadeda6b432a8448051d3cb01512` |
| Configurações | `aee60d4ed9ea493a8d5772a5f2584f62` |
