# 🎨 UI Design System - Visual Reference

## Color Palette

### Primary Colors
```
Teal (Primary Action)
  Light: #14b8a6
  Used for: Main CTAs, hover states, accents
  Example: Gradient buttons, active elements

Blue (Secondary)
  Light: #3b82f6
  Used for: Information, secondary actions
  Example: Info cards, secondary buttons

Slate (Background)
  Dark: #0f172a (slate-900)
  Medium: #1e293b (slate-800)
  Light: #475569 (slate-700)
  Used for: Backgrounds, borders, overlays
```

### Status Colors
```
Emerald (Success)
  Light: #10b981
  Used for: Compliant status, success states
  
Red (Error/Critical)
  Light: #ef4444
  Used for: Errors, critical alerts, deficiencies
  
Amber (Warning)
  Light: #f59e0b
  Used for: Warnings, pending status
  
Purple (Additional Info)
  Light: #a855f7
  Used for: Additional info, alternate emphasis
```

---

## Component Examples

### Stat Card Pattern
```jsx
<div className="relative p-6 bg-gradient-to-br from-[COLOR]-500/10 to-[COLOR]-600/5 
                border border-[COLOR]-500/20 rounded-xl 
                hover:border-[COLOR]-400/40 transition-all duration-300">
  <div className="flex items-center justify-between mb-4">
    <div className="p-3 bg-[COLOR]-500/20 rounded-lg">
      <Icon className="w-6 h-6 text-[COLOR]-400" />
    </div>
  </div>
  <h3 className="text-sm font-medium text-slate-400 mb-1">Label</h3>
  <p className="text-3xl font-bold text-white">Value</p>
</div>
```

Colors Used:
- `from-teal-500/10` → Background gradient start
- `to-teal-600/5` → Background gradient end
- `border-teal-500/20` → Border color
- `hover:border-teal-400/40` → Hover border
- `bg-teal-500/20` → Icon background
- `text-teal-400` → Icon color

### Action Button Pattern
```jsx
<button className="relative p-6 rounded-xl border transition-all duration-300
         bg-[COLOR]-500/20 border-[COLOR]-500/20 
         hover:border-[COLOR]-400/40 hover:shadow-lg">
  <div className="absolute top-0 right-0 w-24 h-24 
                  bg-[COLOR]-500/10 rounded-full blur-2xl -z-10"></div>
  <div className="relative z-10">
    <div className="flex items-start justify-between mb-3">
      <div className="p-2.5 rounded-lg bg-[COLOR]-500/20">
        <Icon className="w-5 h-5 text-[COLOR]-400" />
      </div>
    </div>
    <h4 className="font-semibold text-white">Title</h4>
  </div>
</button>
```

### List Item Pattern
```jsx
<div className="p-6 transition-all duration-300 
     border-l-4 border-transparent hover:border-teal-400 
     bg-slate-800/30 hover:bg-slate-700/30">
  <div className="flex items-start justify-between gap-4">
    <div className="flex-1">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-lg font-bold text-white">Title</h3>
        <Badge className="bg-[COLOR]-500/20 text-[COLOR]-300 
                         border-[COLOR]-400/30">
          <Icon className="w-3 h-3 mr-1" />
          Status
        </Badge>
      </div>
    </div>
  </div>
</div>
```

---

## Typography System

### Heading Levels
```
H1 - Page Title
  Class: text-4xl font-bold text-white
  Usage: Main dashboard headings
  
H2 - Section Title
  Class: text-2xl font-bold bg-gradient-to-r from-teal-200 to-blue-200 
         bg-clip-text text-transparent
  Usage: Section headers with gradient text
  
H3 - Card Title
  Class: text-lg font-bold text-white
  Usage: Card headers, subsection titles
  
Body - Main Content
  Class: text-base text-slate-200/300
  Usage: Regular body text
  
Small - Secondary Text
  Class: text-sm text-slate-400/500
  Usage: Labels, descriptions
  
Tiny - Meta Text
  Class: text-xs text-slate-500/600
  Usage: Timestamps, meta information
```

---

## Spacing Reference

### 8px Grid System
```
1 unit = 8px

Sizes:
  px-2/py-2    = 8px (very compact)
  px-3/py-3    = 12px (compact)
  px-4/py-4    = 16px (standard)
  px-6/py-6    = 24px (comfortable) ← Most common
  px-8/py-8    = 32px (spacious)
  px-12/py-12  = 48px (very spacious)

Gap Between Items:
  gap-3 = 12px
  gap-4 = 16px
  gap-6 = 24px ← Most common

Card Padding: p-6 (24px)
Card Header Bottom: pb-6 (24px margin)
```

---

## Animation Examples

### Fade In (Entrance)
```css
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in { animation: fade-in 0.6s ease-out; }
.animate-fade-in-delay-100 { animation: fade-in 0.6s ease-out 0.1s both; }
.animate-fade-in-delay-200 { animation: fade-in 0.6s ease-out 0.2s both; }
```

### Transition Pattern
```css
transition-all duration-300

Used for:
- Hover effects
- Color changes
- Border changes
- Shadow changes
```

---

## Responsive Breakpoints

### Mobile First
```
< 768px   - Mobile devices
  - Single column
  - Adjusted padding
  - Larger tap targets
  
≥ 768px   - Tablets & Small screens
  - 2 columns
  - Full spacing
  
≥ 1024px  - Desktop
  - 3-4 columns
  - Full features
```

### Responsive Classes
```
grid-cols-1         → Mobile
md:grid-cols-2      → Tablet
lg:grid-cols-3      → Desktop
lg:grid-cols-4      → Large desktop
```

---

## Glassmorphism Effects

### Backdrop Blur
```jsx
<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700">
  {/* Content */}
</div>
```

- `bg-slate-800/50` → Semi-transparent dark background
- `backdrop-blur-sm` → Slight blur effect (4px)
- `border border-slate-700` → Subtle border

---

## Shadow & Glow Effects

### Card Shadows
```
shadow-xl          → Standard card shadow
shadow-glow-teal   → Teal glow effect
shadow-glow-blue   → Blue glow effect
```

### Hover Glow
```jsx
hover:shadow-lg
hover:shadow-blue-500/10    → Subtle blue shadow
```

---

## Icon Usage

### Colors
```
Teal:    text-teal-400
Blue:    text-blue-400
Red:     text-red-400
Amber:   text-amber-400
Emerald: text-emerald-400
Purple:  text-purple-400
```

### Sizes
```
Small:   w-3 h-3 or w-4 h-4
Medium:  w-5 h-5 or w-6 h-6
Large:   w-8 h-8 or w-10 h-10
XL:      w-12 h-12 or w-16 h-16
```

---

## Badge/Status Styling

### Pattern
```jsx
<Badge className="bg-[COLOR]-500/20 text-[COLOR]-300 border-[COLOR]-400/30">
  <Icon className="w-3 h-3 mr-1" />
  Status Text
</Badge>
```

### Color Combinations
```
Success (Emerald):
  bg-emerald-500/20 text-emerald-300 border-emerald-400/30
  
Warning (Amber):
  bg-amber-500/20 text-amber-300 border-amber-400/30
  
Error (Red):
  bg-red-500/20 text-red-300 border-red-400/30
  
Info (Blue):
  bg-blue-500/20 text-blue-300 border-blue-400/30
```

---

## Button Variants

### Gradient Button
```jsx
<Button className="bg-gradient-to-r from-teal-600 to-blue-600 
                  hover:from-teal-700 hover:to-blue-700 group">
  <Icon className="w-4 h-4 mr-2 group-hover:translate-y-0.5 
                  transition-transform" />
  Action Text
</Button>
```

### Ghost Button
```jsx
<Button variant="outline" 
        className="text-teal-400 border-teal-400/30 
                  hover:bg-teal-500/10 transition-all">
  <Icon className="w-4 h-4 mr-1" />
  View
</Button>
```

### Standard Button
```jsx
<Button className="bg-blue-600 hover:bg-blue-700 transition-colors">
  Action
</Button>
```

---

## Dark Mode Theme

### Background Layers
```
Primary Background:    #0f172a (slate-900)
Secondary Background:  #1e293b (slate-800)
Card Background:       rgba(30, 41, 59, 0.5) with backdrop blur
Overlay Background:    rgba(15, 23, 42, 0.5) with backdrop blur
```

### Text Layers
```
Primary Text:      #ffffff (white)
Secondary Text:    #e2e8f0 (slate-200)
Tertiary Text:     #cbd5e1 (slate-300)
Hint Text:         #94a3b8 (slate-400)
Disabled Text:     #64748b (slate-500)
```

### Border Colors
```
Primary Border:    #475569 (slate-700)
Hover Border:      rgba(20, 184, 166, 0.4) (teal with opacity)
Subtle Border:     #334155 (slate-600)
```

---

## Consistency Checklist

When creating new components, ensure:

- [ ] Using correct color palette
- [ ] Following spacing guidelines (8px grid)
- [ ] Using standard typography sizes
- [ ] Applying smooth transitions (0.3s)
- [ ] Including hover states
- [ ] Responsive breakpoints applied
- [ ] Icons colored consistently
- [ ] Animations use standard timing
- [ ] Sufficient color contrast
- [ ] Touch-friendly button sizes (44px minimum)

---

## Quick Copy-Paste Templates

### Stat Card
```jsx
<div className="relative p-6 bg-gradient-to-br from-teal-500/10 to-teal-600/5 border border-teal-500/20 rounded-xl hover:border-teal-400/40 transition-all duration-300">
  <div className="p-3 bg-teal-500/20 rounded-lg">
    <Icon className="w-6 h-6 text-teal-400" />
  </div>
  <h3 className="text-sm font-medium text-slate-400 mb-1">Label</h3>
  <p className="text-3xl font-bold text-white">Value</p>
</div>
```

### Action Button
```jsx
<button className="p-6 rounded-xl border border-teal-500/20 bg-teal-500/20 hover:border-teal-400/40 transition-all group">
  <Icon className="w-5 h-5 text-teal-400 group-hover:translate-x-1 transition-transform" />
  <h4 className="font-semibold text-white">Title</h4>
</button>
```

### List Item
```jsx
<div className="p-6 border-l-4 border-transparent hover:border-teal-400 bg-slate-800/30 hover:bg-slate-700/30 transition-all duration-300">
  <h3 className="text-lg font-bold text-white">Title</h3>
  <Badge className="bg-teal-500/20 text-teal-300 border-teal-400/30">Status</Badge>
</div>
```

---

## Final Notes

This design system provides:
- ✅ Consistent visual language
- ✅ Reusable component patterns
- ✅ Professional appearance
- ✅ Smooth interactions
- ✅ Responsive design
- ✅ Accessibility compliance

Use these patterns as templates for any new components!

