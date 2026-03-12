# Page Conventions - Comparative Analysis

## 1. ROOT WRAPPER COMPARISON

| Page | Root Wrapper | Status |
|------|--------------|--------|
| **Packages** | `<PageTransition className="space-y-5">` | ✅ Correct |
| **Notifications** | `<PageTransition className="space-y-5">` | ✅ Correct |
| **Profile** | `<div className="space-y-6 max-w-2xl">` | ⚠️ No PageTransition |
| **Settings** | `<SettingsContent>` (nested) | ⚠️ No PageTransition |
| **Dashboard** | Redirect only | ✅ N/A |
| **Analytics** | `<div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">` | ❌ Missing PageTransition |
| **Map** | `<div className="flex flex-col h-[calc(100vh-1rem)] md:h-screen">` | ❌ Missing PageTransition |

**🎯 Convention: ALL pages MUST start with `<PageTransition>`**

---

## 2. HEADER STYLING COMPARISON

### h1 (Page Title)
| Page | Classes | Status |
|------|---------|--------|
| **Packages** | `text-2xl font-bold tracking-tight text-foreground` | ✅ Correct |
| **Notifications** | `text-2xl font-bold tracking-tight text-foreground` | ✅ Correct |
| **Profile** | `text-2xl font-bold tracking-tight text-foreground` | ✅ Correct |
| **Analytics** | `text-2xl font-bold text-foreground` | ❌ Missing `tracking-tight` |
| **Map** | `text-2xl font-bold text-foreground` | ❌ Missing `tracking-tight` |

### p (Subtitle)
| Page | Classes | Status |
|------|---------|--------|
| **Packages** | `text-sm text-muted-foreground/80 mt-0.5` | ✅ Correct |
| **Notifications** | `text-sm text-muted-foreground/80 mt-0.5` | ✅ Correct |
| **Profile** | `text-sm text-muted-foreground/80 mt-0.5` | ✅ Correct |
| **Analytics** | `text-sm text-muted-foreground` | ❌ Missing `/80` and `mt-0.5` |
| **Map** | `text-sm text-muted-foreground` | ❌ Missing `/80` and `mt-0.5` |

**🎯 Convention: h1 = `text-2xl font-bold tracking-tight text-foreground`**
**🎯 Convention: p = `text-sm text-muted-foreground/80 mt-0.5`**

---

## 3. HEADER STRUCTURE COMPARISON

| Page | Layout Type | Actions | NotificationBell | Status |
|------|-------------|---------|------------------|--------|
| **Packages** | Flex row responsive | Yes | ✅ Yes | ✅ Correct |
| **Notifications** | Flex row responsive | Yes | ✅ Yes | ✅ Correct |
| **Profile** | Flex row responsive | None | ✅ Yes | ✅ Correct |
| **Analytics** | Simple div | None | ❌ No | ❌ Missing flex layout |
| **Map** | Simple div | None | ❌ No | ❌ Missing flex layout |

**🎯 Convention: Headers MUST use `flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`**
**🎯 Convention: NotificationBell is `hidden md:block` on right side**

---

## 4. ANIMATION WRAPPER COMPARISON

### FadeIn Pattern
| Page | FadeIn on Header | FadeIn on Sections | Delay Pattern | Status |
|------|------------------|-------------------|---------------|--------|
| **Packages** | ✅ Line 286 | ✅ Multiple | ✅ 0, 0.05, 0.1, 0.15 | ✅ Correct |
| **Notifications** | ✅ Line 133 | ✅ Multiple | ✅ 0, 0.05 | ✅ Correct |
| **Profile** | ❌ No FadeIn | ❌ No FadeIn | N/A | ⚠️ Missing |
| **Analytics** | ❌ No FadeIn | ❌ No FadeIn | N/A | ❌ All missing |
| **Map** | ❌ No FadeIn | ❌ No FadeIn | N/A | ❌ All missing |

**🎯 Convention: Every section wrapped in `<FadeIn delay={n * 0.05}>`**
**🎯 Convention: Delays increment: 0, 0.05, 0.1, 0.15, 0.2, etc.**

---

## 5. CARD HEADER ICON PATTERN

| Page | Has Icon | Icon Size | Icon Color | CardTitle Structure | Status |
|------|----------|-----------|-----------|-------------------|--------|
| **Notifications** | ✅ Bell | h-4 w-4 | text-primary | `flex items-center gap-2` | ✅ Correct |
| **Profile** (Account) | ✅ Shield | h-4 w-4 | text-primary | `flex items-center gap-2` | ✅ Correct |
| **Profile** (Stats) | ✅ BarChart3 | h-4 w-4 | text-primary | `flex items-center gap-2` | ✅ Correct |
| **Analytics** (Charts) | ❌ None | N/A | N/A | Just h3 text | ❌ Missing icons |
| **Map** | N/A | N/A | N/A | No Card headers | N/A |

**🎯 Convention: Card headers MUST have `<CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" /> Title</CardTitle>`**

---

## 6. EMPTY STATE PATTERN COMPARISON

### Icon Styling
| Page | Icon Container | Icon Size | Icon Color | Background | Status |
|------|-----------------|-----------|-----------|------------|--------|
| **Notifications** | h-16 w-16 | h-7 w-7 | text-primary/40 | from-primary/10 to-violet-500/10 | ✅ Correct |
| **Profile** (Error) | h-14 w-14 | h-7 w-7 | text-destructive | bg-destructive/10 | ✅ Correct pattern |
| **Analytics** | ❌ Direct icon | h-16 w-16 | text-muted-foreground/30 | None | ❌ Missing wrapper |
| **Map** | ❌ Direct icon | h-10 w-10 | text-muted-foreground/30 | None | ❌ Missing wrapper |

### Text Styling
| Page | Main Text | Hint Text | Status |
|------|-----------|-----------|--------|
| **Notifications** | text-sm font-semibold text-foreground/70 | text-xs text-muted-foreground/60 | ✅ Correct |
| **Analytics** | text-muted-foreground | None | ❌ Wrong colors |
| **Map** | text-sm text-muted-foreground | None | ❌ Missing hint text |

**🎯 Convention:**
- **Icon container**: h-16 w-16, rounded-2xl, bg-gradient-to-br from-primary/10 to-violet-500/10
- **Icon inside**: h-7 w-7, text-primary/40
- **Main text**: text-sm font-semibold text-foreground/70
- **Hint text**: text-xs text-muted-foreground/60

---

## 7. LOADING STATE COMPARISON

| Page | Wrapper | Spinner | Status |
|------|---------|---------|--------|
| **Profile** | `<ProfileSkeleton />` | Component | ✅ Correct |
| **Notifications** | Array of skeleton items | N/A | ✅ Correct |
| **Packages** | Skeleton card + items | N/A | ✅ Correct |
| **Analytics** | `<div>` with spinner | Centered div | ❌ Missing PageTransition |
| **Map** | `<div>` with spinner | Centered div | ❌ Missing PageTransition |

**🎯 Convention: Loading states should be wrapped in `<PageTransition>`**

---

## 8. i18n USAGE COMPARISON

| Page | useI18n Pattern | Locale Mapping | Status |
|------|-----------------|-----------------|--------|
| **Packages** | `const { t } = useI18n();` | Not used (no dates) | ✅ Correct |
| **Notifications** | `const { t, locale } = useI18n();` with mapping | ✅ Full mapping | ✅ Correct |
| **Profile** | `const { t, locale } = useI18n();` with mapping | ✅ Full mapping | ✅ Correct |
| **Settings** | `const { t, locale, setLocale } = useI18n();` | ✅ Full mapping | ✅ Correct |
| **Analytics** | `const { t } = useI18n();` | Not used (no dates) | ✅ Correct |
| **Map** | `const { t } = useI18n();` | Not used (no dates) | ✅ Correct |

**Note:** All pages correctly use i18n. No issues here.

---

## 9. API QUERY PATTERNS

| Page | Pattern | Complexity | Status |
|------|---------|-----------|--------|
| **Packages** | `useInfiniteQuery` | Complex with filters | ✅ Correct |
| **Notifications** | `useInfiniteQuery` | Complex with pagination | ✅ Correct |
| **Profile** | `Promise.all` in useEffect | Multiple endpoints | ✅ Correct |
| **Settings** | Multiple `useQuery` | Multiple queries | ✅ Correct |
| **Analytics** | Direct `api.getDashboard()` | Simple single call | ✅ Correct |
| **Map** | Direct `api.getDashboard()` | Simple single call | ✅ Correct |

**Note:** All data fetching patterns are correct. No issues here.

---

## 10. SPACING & RESPONSIVE PATTERNS

### Page Level
| Page | Root spacing | Max-width | Padding | Status |
|------|--------------|-----------|---------|--------|
| **Packages** | space-y-5 | None (full width) | None | ✅ Correct |
| **Notifications** | space-y-5 | None (full width) | None | ✅ Correct |
| **Profile** | space-y-6 | max-w-2xl | None | ✅ Correct |
| **Analytics** | space-y-6 | max-w-6xl | p-4 md:p-6 | ✅ Correct |
| **Map** | None | None | p-4 md:p-6 | ❌ Should have space-y-# |

---

## SUMMARY TABLE - ALL ISSUES

| Issue Type | Analytics | Map | Status |
|------------|-----------|-----|--------|
| Missing PageTransition | ❌ Line 132 | ❌ Line 199 | **Critical** |
| Missing FadeIn (header) | ❌ Line 134 | ❌ Line 201 | **Critical** |
| Missing tracking-tight on h1 | ❌ Line 135 | ❌ Line 202 | **Minor styling** |
| Wrong subtitle color | ❌ Line 136 | ❌ Line 203 | **Minor styling** |
| Missing NotificationBell | ❌ Line 134+ | ❌ Line 201+ | **UX consistency** |
| Missing FadeIn (sections) | ❌ Lines 140-244 | ✅ Acceptable | **Animation** |
| Card structure inconsistency | ❌ Lines 162-244 | N/A | **Structure** |
| Empty state gradient | ✅ Acceptable | ❌ Line 248 | **UX consistency** |
| Loading PageTransition | ⚠️ Acceptable | ❌ Line 191 | **Minor** |

---

## PRIORITY FIXES

### 🔴 CRITICAL (Must fix immediately)
1. ✅ **PageTransition wrapper** - Both pages
2. ✅ **FadeIn on headers** - Both pages
3. ✅ **NotificationBell** - Both pages

### 🟡 HIGH (Should fix)
4. ✅ **Styling: tracking-tight, text-muted-foreground/80, mt-0.5** - Both pages
5. ✅ **FadeIn on all sections** - Analytics page
6. ✅ **Card headers with icons** - Analytics page

### 🟢 LOW (Nice to have)
7. ✅ **Empty state gradient icons** - Map page
8. ✅ **Loading state PageTransition** - Both pages

