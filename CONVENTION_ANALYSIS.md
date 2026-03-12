# Next.js App Pages Convention Analysis

## CONVENTIONS IN EXISTING PAGES

### 1. **Layout Patterns**

**Pattern Used:**
- **Root wrapper**: `<PageTransition>` motion component wrapping entire page
- **Content spacing**: `space-y-5` or `space-y-6` for vertical spacing between major sections
- **Max width containers**: `max-w-2xl`, `max-w-6xl`, or no max-width for full-width (analytics)
- **Responsive padding**: `p-4 md:p-6` for pages with padding; header often has `pb-2`
- **Grid layouts**: `grid grid-cols-1 md:grid-cols-2/4` for stats cards

**Examples:**
- **Notifications** (lines 131-342): `<PageTransition className="space-y-5">` wrapper
- **Profile** (lines 125-337): `<div className="space-y-6 max-w-2xl">` (no PageTransition)
- **Packages** (lines 283-569): `<PageTransition className="space-y-5">` with multiple FadeIn sections
- **Analytics** (lines 133-245): `<div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">`

### 2. **Animation Components**

**Primary Components Used:**
- `PageTransition`: Root wrapper for entire page (from `@/components/ui/motion`)
- `FadeIn`: Individual section animations with optional `delay` prop
- `StaggerContainer` + `StaggerItem`: For grid animations (packages page)
- `AnimatedNumber`: For animated stat counters
- Framer Motion `motion.div`: Direct framer-motion for custom animations

**Patterns:**
- Header sections: `<FadeIn>` (no delay)
- Cards/sections: `<FadeIn delay={0.05}>`, `<FadeIn delay={0.1}>`, etc. (staggered)
- Container grids: `<StaggerContainer>` with `<StaggerItem>` children
- Charts: `<motion.div>` with `initial={{ opacity: 0, y: 20 }}` and `animate={{ opacity: 1, y: 0 }}`

**Examples:**
- Notifications header (line 133): `<FadeIn>` with no delay
- Notifications card (line 174): `<FadeIn delay={0.05}>`
- Analytics stat cards (lines 147-158): `<motion.div>` with delays 0.1, 0.2, etc.
- Packages grid (line 521): `<StaggerContainer>` with `grid grid-cols-1 gap-3`

### 3. **Card Components**

**Structure:**
```tsx
<Card>
  <CardHeader className="pb-3">
    <CardTitle className="flex items-center gap-2 text-base">
      <IconComponent />
      Title
    </CardTitle>
    <CardDescription>Optional subtitle</CardDescription>
  </CardHeader>
  <Separator /> {/* Optional */}
  <CardContent className="p-0"> {/* or custom padding */}
    Content here
  </CardContent>
</Card>
```

**Patterns:**
- CardHeader: Always has `pb-3` padding bottom
- CardTitle: Icon + text using `flex items-center gap-2` + `text-base`
- CardDescription: Subtitle with semantic color
- Icons: Primary colored with `h-4 w-4` and `text-primary`
- Separator: Used between header and content (notifications, profile)

**Examples:**
- Notifications card (lines 175-341): Header with badge, separator, content
- Profile card (lines 197-257): Account Details card with grid of label/value pairs
- Profile stats card (lines 261-334): 3x2 grid of stat boxes

### 4. **Loading States**

**Patterns:**
1. **Skeleton components**: `<Skeleton>` imported from `@/components/ui/skeleton`
   - Custom layout: Array of skeletons mimicking content structure
2. **Spinner**: `animate-spin` with Tailwind classes
   - `<div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />`
3. **LogoSpinner**: Animated logo component for full-page loads

**Examples:**
- Notifications (lines 219-231): Skeleton list mimicking notification items
- Profile (line 89): Returns `<ProfileSkeleton />`
- Analytics (lines 55-61): Centered spinner during loading
- Map (lines 191-196): Centered spinner during loading
- Packages (lines 311-337): Skeleton card mimicking stats bar

### 5. **Header Patterns**

**Standard Header Structure:**
```tsx
<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div>
    <h1 className="text-2xl font-bold tracking-tight text-foreground">
      {t("page.title")}
    </h1>
    <p className="text-sm text-muted-foreground/80 mt-0.5">
      {t("page.subtitle")}
    </p>
  </div>
  <div className="flex items-center gap-2">
    {/* Action buttons and NotificationBell */}
  </div>
</div>
```

**Consistent Styling:**
- h1: `text-2xl font-bold tracking-tight text-foreground`
- p: `text-sm text-muted-foreground/80 mt-0.5`
- Actions: Right-aligned, gap-2 flex row
- NotificationBell: Hidden on mobile (`hidden md:block`)

**Examples:**
- Notifications (lines 134-170): Header with title, subtitle, action buttons
- Profile (lines 126-134): Header with NotificationBell on right
- Packages (lines 287-307): Header with AddPackageDialog, scan, sync, notifications
- Analytics (lines 134-137): Simpler header without actions
- Map (lines 201-204): Simpler header style

### 6. **i18n Usage**

**Pattern:**
```tsx
const { t, locale } = useI18n();
// locale can be: "en", "he", "ar", "ru", etc.

// Usage:
<h1>{t("page.title")}</h1>
<Button>{t("common.delete")}</Button>

// Date locale mapping:
const dateLocale = locale === "he" ? "he-IL" 
  : locale === "ar" ? "ar" 
  : locale === "ru" ? "ru-RU" 
  : "en-US";
```

**Patterns:**
- Always destructure `t` and `locale` from `useI18n()`
- Use semantic i18n keys: `"section.key"` format
- Date locale mapping is consistent across all pages
- Toast messages use `t()`: `toast.success(t("toast.allMarkedRead"))`

**Examples:**
- Profile (line 35): `const { t, locale } = useI18n();`
- Notifications (lines 66-67): With date locale mapping

### 7. **Data Fetching**

**Patterns:**
1. **useQuery**: For initial data loads with caching
   ```tsx
   const { data, isLoading, error } = useQuery({
     queryKey: ["resource", filter],
     queryFn: () => api.resource(params),
     staleTime: 60_000, // Optional
   });
   ```

2. **useInfiniteQuery**: For pagination/infinite scroll
   ```tsx
   const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
     queryKey: ["packages", filter],
     queryFn: ({ pageParam = 1 }) => api.getPackages({ page: pageParam }),
     getNextPageParam: (lastPage) => lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
     initialPageParam: 1,
   });
   ```

3. **useMutation**: For mutations with invalidation
   ```tsx
   const mutation = useMutation({
     mutationFn: (payload) => api.update(payload),
     onSuccess: () => {
       toast.success(t("toast.success"));
       queryClient.invalidateQueries({ queryKey: ["resource"] });
     },
   });
   ```

**Examples:**
- Notifications (lines 72-92): useInfiniteQuery with pagination
- Profile (lines 54-69): useEffect with Promise.all for parallel loads
- Packages (lines 138-166): useInfiniteQuery with complex params
- Settings (lines 88-92): Multiple useQuery calls

### 8. **Theme/Styling**

**Color Variables Used (from shadcn/ui theme):**
- `text-foreground`: Primary text
- `text-muted-foreground`: Secondary text (reduced contrast)
- `text-destructive`: Error/danger states
- `bg-card`: Card backgrounds
- `bg-primary`, `bg-primary/10`, `bg-primary/20`: Primary color variants
- `border-border`, `border-border/60`: Border colors with opacity

**Spacing Conventions:**
- Gap between sections: `space-y-5` or `space-y-6`
- Gap between elements: `gap-1.5`, `gap-2`, `gap-3`, `gap-4`
- Padding: `p-3`, `p-4`, `p-5`, `px-4`, `py-3` (usually multiples of 4px)
- Margin: `mt-0.5`, `mt-1.5`, `mb-4` (specific fine-tuning)

**Responsive Patterns:**
- `flex flex-col sm:flex-row` for horizontal on mobile, row on desktop
- `hidden md:block` for desktop-only elements (NotificationBell)
- `hidden sm:inline` for tablet+ text labels
- `max-w-[240px]` for responsive max-widths

**Icon Sizing:**
- Small icons in text: `h-3 w-3`, `h-3.5 w-3.5`
- Medium icons: `h-4 w-4`
- Large icons: `h-5 w-5`, `h-7 w-7`
- Extra large: `h-16 w-16`

### 9. **Empty States**

**Pattern:**
```tsx
<div className="flex flex-col items-center justify-center py-16 px-4">
  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10 mb-4">
    <IconComponent className="h-7 w-7 text-primary/40" />
  </div>
  <p className="text-sm font-semibold text-foreground/70">
    {t("section.empty")}
  </p>
  <p className="text-xs text-muted-foreground/60 mt-1.5 text-center max-w-[240px]">
    {t("section.emptyHint")}
  </p>
</div>
```

**Characteristics:**
- Large icon with gradient background (h-16 w-16)
- Icon color: `text-primary/40` (muted)
- Background: `bg-gradient-to-br from-primary/10 to-violet-500/10`
- Main text: `text-sm font-semibold text-foreground/70`
- Hint text: `text-xs text-muted-foreground/60`
- Centered with padding (py-16 px-4)

**Examples:**
- Notifications (lines 233-244): Empty notifications with icon and hints
- Map (lines 248-252): No locations empty state
- Analytics (lines 64-69): No data empty state

### 10. **Common Imports**

**Essential imports on every page:**
```tsx
"use client";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { PageTransition, FadeIn } from "@/components/ui/motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
```

**Common UI components:**
- `Card` family: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
- `Badge`, `Button`, `Input`, `Label`, `Select`
- `ToggleGroup`, `ToggleGroupItem`
- `Separator`, `Tooltip`, `Dialog`
- `Alert`, `AlertDescription`, `AlertTitle`

**Icons (from lucide-react):**
```tsx
import { Bell, Package, Truck, CheckCircle2, Trash2, RefreshCw, ... } from "lucide-react";
```

**Hooks:**
```tsx
import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useMemo } from "react";
```

---

## NEW PAGES ISSUES

---

## ANALYTICS PAGE (`/analytics/page.tsx`) - VIOLATIONS

### ❌ **Issue 1: Missing PageTransition wrapper** (Lines 132-245)
**Problem:** Page doesn't use `PageTransition` wrapper
```tsx
// WRONG (current):
return (
  <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
    ...
  </div>
);
```

**Should be:**
```tsx
// CORRECT:
return (
  <PageTransition className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
    ...
  </PageTransition>
);
```

**Fix location:** Line 133 - Replace outer div with PageTransition

---

### ❌ **Issue 2: Missing FadeIn animations on sections** (Lines 134-245)
**Problem:** Header and sections not wrapped in FadeIn components with staggered delays

**Current (lines 134-137):**
```tsx
<div>
  <h1 className="text-2xl font-bold text-foreground">{t("analytics.title")}</h1>
  <p className="text-sm text-muted-foreground">{t("analytics.subtitle")}</p>
</div>
```

**Should be:**
```tsx
<FadeIn>
  <div>
    <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("analytics.title")}</h1>
    <p className="text-sm text-muted-foreground/80 mt-0.5">{t("analytics.subtitle")}</p>
  </div>
</FadeIn>
```

**Fix locations:**
- Line 134: Wrap header div in `<FadeIn>`
- Line 140: Wrap stat cards grid in `<FadeIn delay={0.05}>`
- Line 162: Wrap charts grid in `<FadeIn delay={0.1}>`
- Line 222: Wrap timeline in `<FadeIn delay={0.15}>`

---

### ❌ **Issue 3: Inconsistent header styling** (Lines 134-137)
**Problem:** Header doesn't include "tracking-tight" on h1 and missing proper subtitle styling

**Current:**
```tsx
<h1 className="text-2xl font-bold text-foreground">{t("analytics.title")}</h1>
<p className="text-sm text-muted-foreground">{t("analytics.subtitle")}</p>
```

**Should be:**
```tsx
<h1 className="text-2xl font-bold tracking-tight text-foreground">{t("analytics.title")}</h1>
<p className="text-sm text-muted-foreground/80 mt-0.5">{t("analytics.subtitle")}</p>
```

**Changes:**
- Add `tracking-tight` to h1
- Change `text-muted-foreground` to `text-muted-foreground/80` on p
- Add `mt-0.5` margin to p

**Fix location:** Lines 135-136

---

### ❌ **Issue 4: Missing motion animations (use framer-motion correctly)** (Lines 147-158)
**Problem:** Using `motion.div` from framer-motion directly, but should be importing from the motion components

**Current (lines 147-158):**
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: i * 0.1 }}
  className="..."
>
```

**Analysis:** This is actually CORRECT usage (it's using framer-motion directly which is acceptable for charts), but other pages use `<FadeIn delay={}>` helper. The stat cards should use FadeIn wrapper approach instead for consistency.

**Should be:**
```tsx
<FadeIn delay={0.05}>
  <div className="rounded-xl border border-border bg-card p-4">
    ...
  </div>
</FadeIn>
```

**Fix location:** Lines 141-159 - Replace motion.div loop with FadeIn-wrapped elements

---

### ❌ **Issue 5: Header should have optional action area** (Lines 134-137)
**Problem:** No room for NotificationBell or other actions (inconsistent with other pages)

**Current structure:**
```tsx
<div>
  <h1>...</h1>
  <p>...</p>
</div>
```

**Should match other pages:**
```tsx
<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div>
    <h1>...</h1>
    <p>...</p>
  </div>
  <div className="hidden md:block">
    <NotificationBell />
  </div>
</div>
```

**Fix location:** Lines 134-137 - Wrap in flex layout with NotificationBell

---

### ❌ **Issue 6: Stat cards grid missing proper FadeIn structure** (Lines 140-159)
**Problem:** Using motion.div in a loop instead of StaggerContainer pattern

**Current:**
```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  {[...].map((stat, i) => (
    <motion.div key={i} initial={...} animate={...} transition={{ delay: i * 0.1 }}>
```

**Could be cleaner with:**
```tsx
<StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4">
  {[...].map((stat) => (
    <StaggerItem key={stat.label}>
      <div className="rounded-xl border border-border bg-card p-4">
        ...
      </div>
    </StaggerItem>
  ))}
</StaggerContainer>
```

**Fix location:** Lines 140-159 - Consider using StaggerContainer/StaggerItem pattern

---

### ❌ **Issue 7: Charts missing section titles with proper styling** (Lines 162-244)
**Problem:** Chart sections don't have proper Card headers like other pages

**Current (lines 170, 202, 229):**
```tsx
<h3 className="text-sm font-semibold text-foreground mb-4">{t("analytics.packagesByStatus")}</h3>
```

**Should use Card structure:**
```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2 text-base">
      <IconComponent className="h-4 w-4 text-primary" />
      {t("analytics.packagesByStatus")}
    </CardTitle>
  </CardHeader>
  <CardContent>
    {/* chart here */}
  </CardContent>
</Card>
```

**Fix locations:** 
- Lines 164-193 (status pie chart)
- Lines 196-218 (carrier bar chart)
- Lines 222-244 (delivery timeline)

---

### ✅ **Issue 8: Max-width and padding are reasonable** (Line 133)
**Status:** CORRECT - `max-w-6xl mx-auto` with `p-4 md:p-6` is appropriate for analytics

---

### ✅ **Issue 9: Loading state is acceptable** (Lines 55-61)
**Status:** CORRECT - Uses simple spinner pattern, though could use FadeIn

---

### ✅ **Issue 10: Empty state exists** (Lines 63-70)
**Status:** Has empty state but should follow standard pattern more closely

**Current:**
```tsx
<div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
  <BarChart3 className="h-16 w-16 text-muted-foreground/30 mb-4" />
  <p className="text-muted-foreground">{t("analytics.noData")}</p>
</div>
```

**Missing:**
- Background icon wrapper with gradient
- Secondary hint text

---

## MAP PAGE (`/map/page.tsx`) - VIOLATIONS

### ❌ **Issue 1: Missing PageTransition wrapper** (Lines 199-281)
**Problem:** Page doesn't use `PageTransition` wrapper

**Current (line 200):**
```tsx
return (
  <div className="flex flex-col h-[calc(100vh-1rem)] md:h-screen">
```

**Should be:**
```tsx
return (
  <PageTransition className="flex flex-col h-[calc(100vh-1rem)] md:h-screen">
    ...
  </PageTransition>
);
```

**Fix location:** Line 200 - Replace outer div with PageTransition

---

### ❌ **Issue 2: Missing FadeIn on header** (Lines 201-204)
**Problem:** Header section not wrapped in FadeIn

**Current:**
```tsx
<div className="p-4 md:p-6 pb-2">
  <h1 className="text-2xl font-bold text-foreground">{t("map.title")}</h1>
  <p className="text-sm text-muted-foreground">{t("map.subtitle")}</p>
</div>
```

**Should be:**
```tsx
<FadeIn>
  <div className="p-4 md:p-6 pb-2">
    <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("map.title")}</h1>
    <p className="text-sm text-muted-foreground/80 mt-0.5">{t("map.subtitle")}</p>
  </div>
</FadeIn>
```

**Fix location:** Lines 201-204 - Wrap in FadeIn component

---

### ❌ **Issue 3: Inconsistent header text styling** (Lines 202-203)
**Problem:** Missing "tracking-tight" on h1 and wrong subtitle text color

**Current:**
```tsx
<h1 className="text-2xl font-bold text-foreground">{t("map.title")}</h1>
<p className="text-sm text-muted-foreground">{t("map.subtitle")}</p>
```

**Should be:**
```tsx
<h1 className="text-2xl font-bold tracking-tight text-foreground">{t("map.title")}</h1>
<p className="text-sm text-muted-foreground/80 mt-0.5">{t("map.subtitle")}</p>
```

**Changes:**
- Add `tracking-tight` to h1
- Change `text-muted-foreground` to `text-muted-foreground/80`
- Add `mt-0.5` margin

**Fix location:** Lines 202-203

---

### ❌ **Issue 4: Missing NotificationBell in header** (Lines 201-204)
**Problem:** Header doesn't include NotificationBell like other pages

**Current:**
```tsx
<div className="p-4 md:p-6 pb-2">
  <h1>...</h1>
  <p>...</p>
</div>
```

**Should be:**
```tsx
<FadeIn>
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 md:p-6 pb-2">
    <div>
      <h1>...</h1>
      <p>...</p>
    </div>
    <div className="hidden md:block">
      <NotificationBell />
    </div>
  </div>
</FadeIn>
```

**Fix location:** Lines 201-204 - Restructure header layout

---

### ❌ **Issue 5: Location list should use FadeIn animation** (Lines 238-277)
**Problem:** Motion.div for location list is correct usage, but could be more consistent

**Current (lines 239-242):**
```tsx
<motion.div
  initial={{ opacity: 0, x: 20 }}
  animate={{ opacity: 1, x: 0 }}
  className="w-full md:w-72 ..."
>
```

**This is acceptable** - Direct framer-motion for sidebars is OK, but should still match overall structure

**Status:** Acceptable but for consistency could wrap entire location section in `<FadeIn delay={0.05}>`

---

### ❌ **Issue 6: Empty state not using standard pattern** (Lines 248-252)
**Problem:** Empty state doesn't follow convention with gradient icon background

**Current:**
```tsx
<div className="flex flex-col items-center justify-center py-8 text-center">
  <MapPin className="h-10 w-10 text-muted-foreground/30 mb-2" />
  <p className="text-sm text-muted-foreground">{t("map.noLocations")}</p>
</div>
```

**Should be:**
```tsx
<div className="flex flex-col items-center justify-center py-8 text-center">
  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10 mb-4">
    <MapPin className="h-5 w-5 text-primary/40" />
  </div>
  <p className="text-sm font-semibold text-foreground/70">
    {t("map.noLocations")}
  </p>
</div>
```

**Changes:**
- Wrap icon in gradient background div
- Icon size: h-5 w-5 (inside h-12 w-12 container)
- Icon color: text-primary/40
- Text styling: font-semibold, text-foreground/70

**Fix location:** Lines 248-252

---

### ❌ **Issue 7: Loading state missing proper FadeIn** (Lines 191-196)
**Problem:** Loading state not wrapped in FadeIn

**Current:**
```tsx
if (loading) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="h-8 w-8 animate-spin ..." />
    </div>
  );
}
```

**Should be:**
```tsx
if (loading) {
  return (
    <PageTransition>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    </PageTransition>
  );
}
```

**Fix location:** Lines 191-196

---

### ✅ **Issue 8: Map container styling is appropriate** (Lines 208-235)
**Status:** CORRECT - Proper border, rounded corners, responsive height

---

### ✅ **Issue 9: Using lazy-loaded components correctly** (Lines 11-26)
**Status:** CORRECT - Dynamic imports with `ssr: false` for Leaflet

---

### ✅ **Issue 10: Location data structure is good** (Lines 97-106)
**Status:** CORRECT - Interface properly defined

---

## SUMMARY OF FIXES NEEDED

### **Analytics Page** (`/analytics/page.tsx`)

1. **Line 132**: Change `<div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">` to `<PageTransition className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">`

2. **Lines 134-137**: Wrap header in `<FadeIn>` and fix styling:
   - Add `tracking-tight` to h1
   - Change subtitle to `text-muted-foreground/80 mt-0.5`
   - Optionally add flex layout for NotificationBell

3. **Lines 140-159**: Wrap stat cards grid in `<FadeIn delay={0.05}>` (or use StaggerContainer)

4. **Lines 162-193**: Wrap pie chart in `<FadeIn delay={0.1}>` and consider using Card structure

5. **Lines 196-218**: Wrap bar chart in `<FadeIn delay={0.15}>` and use Card structure

6. **Lines 222-244**: Wrap timeline in `<FadeIn delay={0.2}>` and use Card structure

7. **Line 245**: Change closing `</div>` to `</PageTransition>`

---

### **Map Page** (`/map/page.tsx`)

1. **Line 199**: Change outer `<div className="flex flex-col h-[calc(100vh-1rem)] md:h-screen">` to `<PageTransition className="flex flex-col h-[calc(100vh-1rem)] md:h-screen">`

2. **Lines 201-204**: Wrap header in `<FadeIn>` and fix styling + add NotificationBell:
   - Add `flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between` to header div
   - Add `tracking-tight` to h1
   - Change subtitle to `text-muted-foreground/80 mt-0.5`
   - Add NotificationBell div

3. **Lines 238-277**: Optionally wrap location section in `<FadeIn delay={0.05}>` for consistency (current motion.div is acceptable but inconsistent)

4. **Lines 248-252**: Update empty state to use gradient icon background pattern

5. **Lines 191-196**: Wrap loading state return in `<PageTransition>`

6. **Line 281**: Change closing `</div>` to `</PageTransition>`

---

## REQUIRED IMPORTS TO ADD

### **Analytics Page** - Add to imports:
```tsx
import { PageTransition, FadeIn } from "@/components/ui/motion";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"; // for chart cards
```

### **Map Page** - Add to imports:
```tsx
import { PageTransition, FadeIn } from "@/components/ui/motion";
import { NotificationBell } from "@/components/notifications/notification-bell";
```

