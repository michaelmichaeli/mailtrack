# Quick Fix Guide - Analytics & Map Pages

## 🔴 ANALYTICS PAGE (`/analytics/page.tsx`) - 8 Issues

### 1. **Line 132: Wrap in PageTransition**
```tsx
// ❌ BEFORE:
return (
  <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">

// ✅ AFTER:
return (
  <PageTransition className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
```

---

### 2. **Lines 134-137: Fix header - Add FadeIn, fix styling, add NotificationBell**
```tsx
// ❌ BEFORE:
<div>
  <h1 className="text-2xl font-bold text-foreground">{t("analytics.title")}</h1>
  <p className="text-sm text-muted-foreground">{t("analytics.subtitle")}</p>
</div>

// ✅ AFTER:
<FadeIn>
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("analytics.title")}</h1>
      <p className="text-sm text-muted-foreground/80 mt-0.5">{t("analytics.subtitle")}</p>
    </div>
    <div className="hidden md:block">
      <NotificationBell />
    </div>
  </div>
</FadeIn>
```

**Changes:**
- Wrap in `<FadeIn>`
- Add flex layout with responsive direction
- Add `tracking-tight` to h1
- Change `text-muted-foreground` → `text-muted-foreground/80`
- Add `mt-0.5` to p
- Add NotificationBell

---

### 3. **Lines 140-159: Wrap stat cards grid in FadeIn**
```tsx
// ❌ BEFORE:
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  {[...].map((stat, i) => (
    <motion.div ...>

// ✅ AFTER:
<FadeIn delay={0.05}>
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {[...].map((stat, i) => (
      <motion.div ...>
```

**Add closing `</FadeIn>` after the map closes**

---

### 4. **Lines 162-193: Wrap pie chart in FadeIn and use Card structure**
```tsx
// ❌ BEFORE:
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.3 }}
  className="rounded-xl border border-border bg-card p-4"
>
  <h3 className="text-sm font-semibold text-foreground mb-4">
    {t("analytics.packagesByStatus")}
  </h3>
  <ResponsiveContainer ...>

// ✅ AFTER:
<FadeIn delay={0.1}>
  <Card>
    <CardHeader>
      <CardTitle className="text-base">
        {t("analytics.packagesByStatus")}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <ResponsiveContainer ...>
```

**Replace closing tags accordingly**

---

### 5. **Lines 196-218: Wrap bar chart in FadeIn and use Card structure**
```tsx
// ❌ BEFORE:
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.4 }}
  className="rounded-xl border border-border bg-card p-4"
>
  <h3 className="text-sm font-semibold text-foreground mb-4">
    {t("analytics.packagesByCarrier")}
  </h3>

// ✅ AFTER:
<FadeIn delay={0.15}>
  <Card>
    <CardHeader>
      <CardTitle className="text-base">
        {t("analytics.packagesByCarrier")}
      </CardTitle>
    </CardHeader>
    <CardContent>
```

---

### 6. **Lines 222-244: Wrap timeline in FadeIn and use Card structure**
```tsx
// ❌ BEFORE:
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.5 }}
  className="rounded-xl border border-border bg-card p-4"
>
  <h3 className="text-sm font-semibold text-foreground mb-4">
    {t("analytics.deliveryTimeline")}
  </h3>

// ✅ AFTER:
<FadeIn delay={0.2}>
  <Card>
    <CardHeader>
      <CardTitle className="text-base">
        {t("analytics.deliveryTimeline")}
      </CardTitle>
    </CardHeader>
    <CardContent>
```

---

### 7. **Line 245: Close PageTransition**
```tsx
// ❌ BEFORE:
    </div>
  );

// ✅ AFTER:
    </PageTransition>
  );
```

---

### 8. **Add imports at top of file**
```tsx
import { PageTransition, FadeIn } from "@/components/ui/motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { NotificationBell } from "@/components/notifications/notification-bell";
```

---

## 🔴 MAP PAGE (`/map/page.tsx`) - 7 Issues

### 1. **Line 199: Wrap in PageTransition**
```tsx
// ❌ BEFORE:
return (
  <div className="flex flex-col h-[calc(100vh-1rem)] md:h-screen">

// ✅ AFTER:
return (
  <PageTransition className="flex flex-col h-[calc(100vh-1rem)] md:h-screen">
```

---

### 2. **Lines 201-204: Fix header - Add FadeIn, fix styling, add NotificationBell**
```tsx
// ❌ BEFORE:
<div className="p-4 md:p-6 pb-2">
  <h1 className="text-2xl font-bold text-foreground">{t("map.title")}</h1>
  <p className="text-sm text-muted-foreground">{t("map.subtitle")}</p>
</div>

// ✅ AFTER:
<FadeIn>
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 md:p-6 pb-2">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("map.title")}</h1>
      <p className="text-sm text-muted-foreground/80 mt-0.5">{t("map.subtitle")}</p>
    </div>
    <div className="hidden md:block">
      <NotificationBell />
    </div>
  </div>
</FadeIn>
```

**Changes same as analytics**

---

### 3. **Lines 191-196: Wrap loading state in PageTransition**
```tsx
// ❌ BEFORE:
if (loading) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="h-8 w-8 animate-spin ..." />
    </div>
  );
}

// ✅ AFTER:
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

---

### 4. **Lines 248-252: Update empty state with gradient background**
```tsx
// ❌ BEFORE:
<div className="flex flex-col items-center justify-center py-8 text-center">
  <MapPin className="h-10 w-10 text-muted-foreground/30 mb-2" />
  <p className="text-sm text-muted-foreground">{t("map.noLocations")}</p>
</div>

// ✅ AFTER:
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
- Add gradient background wrapper (h-12 w-12)
- Change icon size to h-5 w-5
- Change icon color to text-primary/40
- Add font-semibold and text-foreground/70 to text

---

### 5. **Optional - Lines 238-277: Add FadeIn to location list for consistency**
```tsx
// This is optional but recommended for consistency:
<FadeIn delay={0.05}>
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    className="w-full md:w-72 ..."
  >
```

---

### 6. **Line 281: Close PageTransition**
```tsx
// ❌ BEFORE:
    </div>
  );
}

// ✅ AFTER:
    </PageTransition>
  );
}
```

---

### 7. **Add imports at top of file**
```tsx
import { PageTransition, FadeIn } from "@/components/ui/motion";
import { NotificationBell } from "@/components/notifications/notification-bell";
```

---

## Summary of Changes

| File | Changes | Lines Affected |
|------|---------|-----------------|
| **analytics** | 8 fixes | 132, 134-137, 140-159, 162-193, 196-218, 222-244, 245, imports |
| **map** | 7 fixes | 191-196, 199, 201-204, 238-277 (opt), 248-252, 281, imports |

**Estimated time to fix: 20-30 minutes**

---

## 📋 Checklist

### Analytics Page
- [ ] Import PageTransition, FadeIn, Card components, NotificationBell
- [ ] Line 132: Wrap in PageTransition
- [ ] Lines 134-137: Add FadeIn wrapper and fix header
- [ ] Lines 140-159: Add FadeIn delay={0.05} wrapper
- [ ] Lines 162-193: Replace motion.div with FadeIn + Card
- [ ] Lines 196-218: Replace motion.div with FadeIn + Card
- [ ] Lines 222-244: Replace motion.div with FadeIn + Card
- [ ] Line 245: Replace closing div with PageTransition

### Map Page
- [ ] Import PageTransition, FadeIn, NotificationBell
- [ ] Line 191-196: Wrap loading in PageTransition
- [ ] Line 199: Wrap in PageTransition
- [ ] Lines 201-204: Add FadeIn wrapper and fix header
- [ ] Lines 248-252: Update empty state styling
- [ ] Line 281: Replace closing div with PageTransition
- [ ] Optional: Lines 238-277: Add FadeIn wrapper

