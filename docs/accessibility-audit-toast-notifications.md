# Toast & Notification Accessibility Audit

## Executive Summary

This audit examines the accessibility of the toast notification system (using Sonner v2.0.7) and the in-app notification center. The goal is to verify that screen reader users receive proper announcements when toasts appear and new notifications arrive.

## Current Implementation Status

### Toast System (Sonner + Custom ToastContext)

**Strengths:**

1. **Custom ARIA Live Region**: `ToastContext` includes a dedicated ARIA live region:
   ```tsx
   <div
     role="status"
     aria-live="polite"
     aria-atomic="true"
     className="sr-only"
     id="toast-live-region"
   />
   ```
2. **Screen Reader-Only Class**: Uses Tailwind's `sr-only` class for the live region
3. **Proper ARIA Attributes**: Includes `role="status"`, `aria-live="polite"`, `aria-atomic="true"`

**Potential Issues:**

1. **Duplicate Live Regions**: Sonner may create its own live regions internally, potentially causing duplicate announcements
2. **Content Updates**: The custom live region (`#toast-live-region`) is empty and may not be updated with toast content
3. **Politeness Levels**: All toasts use `aria-live="polite"`; error toasts may need `assertive` for critical alerts

### Notification Center

**Strengths:**

1. **Accessible Button**: Notification bell has proper ARIA attributes:
   ```tsx
   <button
     type="button"
     onClick={handleOpen}
     aria-label={`Open notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
     aria-expanded={open}
   />
   ```
2. **Drawer Semantics**: Uses `<aside>` with `aria-label="Notification centre"`

**Potential Issues:**

1. **Live Announcements**: No ARIA live region announces new notification arrivals
2. **Real-time Updates**: No screen reader announcement when notifications arrive via polling
3. **Focus Management**: When drawer opens, focus may not move appropriately

## Testing Methodology

### Manual Testing Required

1. **Screen Reader Testing**:

   - VoiceOver (macOS) or NVDA (Windows) testing
   - Verify toast announcements are heard
   - Check notification arrivals are announced
   - Test focus management

2. **Keyboard Navigation**:

   - Toast dismissal with Escape key
   - Notification drawer opening/closing
   - Focus trapping within drawer

3. **Visual Testing**:
   - Color contrast for toast text/icons
   - Animation timing appropriate for users with motion sensitivity

### Automated Testing

Current test coverage includes:

- `jest-axe` accessibility tests for components
- Basic component tests for `NotificationDrawer` and `ToastContext`
- No dedicated screen reader announcement tests

## Recommendations

### Immediate Fixes (High Priority)

1. **Fix Custom Live Region**:

   ```tsx
   // In ToastContext.tsx, update to actually announce content:
   <div
     role="status"
     aria-live="polite"
     aria-atomic="true"
     className="sr-only"
     id="toast-live-region"
   >
     {/* Content should be updated via state when toasts appear */}
     {currentToastAnnouncement}
   </div>
   ```

2. **Add Notification Announcements**:

   ```tsx
   // In NotificationContext or NotificationBell
   <div
     role="status"
     aria-live="polite"
     className="sr-only"
     aria-label="New notification announcements"
   >
     {unreadCount > prevUnreadCount
       ? `${unreadCount} new notification${unreadCount > 1 ? 's' : ''}`
       : ''}
   </div>
   ```

3. **Configure Sonner Accessibility**:
   ```tsx
   // In AppToaster.tsx, add accessibility props:
   <Toaster
     position={TOAST_POSITION}
     visibleToasts={TOAST_MAX_VISIBLE}
     duration={TOAST_AUTO_DISMISS_MS}
     closeButton
     richColors
     expand={false}
     gap={8}
     // Accessibility improvements:
     aria-live="polite"
     role="region"
     aria-label="Toast notifications"
     toastOptions={{
       classNames: {
         toast: 'font-sans',
       },
     }}
   />
   ```

### Medium Priority Improvements

1. **Differentiate Toast Types**:

   - Use `aria-live="assertive"` for error/warning toasts
   - Use `aria-live="polite"` for success/info toasts

2. **Focus Management**:

   - Ensure focus moves to toast when it appears (if actionable)
   - Implement proper focus trapping in notification drawer

3. **Animation Considerations**:
   - Respect `prefers-reduced-motion` for toast animations
   - Ensure toast timing allows screen readers to announce before dismissal

### Long-term Improvements

1. **Comprehensive Testing**:

   - Add screen reader simulation tests
   - Implement user testing with assistive technology
   - Create accessibility documentation for contributors

2. **Enhanced Feedback**:
   - Haptic feedback options for mobile
   - Customizable announcement verbosity
   - Notification categorization for screen reader filtering

## Technical Implementation Details

### Current Toast Flow

1. `useToast().addToast()` called
2. Calls `showSonnerToast()` with generated ID
3. Sonner renders toast with unknown internal accessibility
4. Custom `#toast-live-region` exists but remains empty

### Required Changes

```typescript
// Enhanced ToastContext.tsx
export function ToastProvider({ children }: { children: ReactNode }) {
  const [announcement, setAnnouncement] = useState('');

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 11);

    // Announce to screen readers
    setAnnouncement(`${toast.title}. ${toast.message || ''}`);

    // Clear announcement after a delay
    setTimeout(() => setAnnouncement(''), 1000);

    showSonnerToast(id, toast);
    return id;
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, updateToast, removeToast }}>
      {children}
      <AppToaster />
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="toast-live-region"
      >
        {announcement}
      </div>
    </ToastContext.Provider>
  );
}
```

```typescript
// Enhanced NotificationBell.tsx
export default function NotificationBell() {
  const [announcement, setAnnouncement] = useState('');
  const prevUnreadRef = useRef(unreadCount);

  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      const newCount = unreadCount - prevUnreadRef.current;
      setAnnouncement(`${newCount} new notification${newCount > 1 ? 's' : ''}`);

      // Clear announcement after reading
      const timer = setTimeout(() => setAnnouncement(''), 3000);
      prevUnreadRef.current = unreadCount;
      return () => clearTimeout(timer);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  return (
    <div className="relative">
      {/* ... existing button ... */}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
        aria-label="Notification updates"
      >
        {announcement}
      </div>
    </div>
  );
}
```

## Verification Checklist

- [ ] Toasts announce to screen readers (VoiceOver/NVDA)
- [ ] New notifications announce arrival count
- [ ] Focus moves appropriately for interactive elements
- [ ] Color contrast meets WCAG AA standards
- [ ] Animations respect reduced motion preferences
- [ ] Keyboard navigation works completely
- [ ] No duplicate announcements from multiple live regions
- [ ] Error toasts use assertive politeness level
- [ ] Toast content is descriptive and actionable

## Dependencies

- **Sonner v2.0.7**: Need to verify internal accessibility implementation
- **jest-axe v10.0.0**: Already configured for accessibility testing
- **Tailwind CSS**: `sr-only` class properly implemented

## Next Steps

1. Implement immediate fixes for live region content updates
2. Test with actual screen reader software
3. Update automated tests to verify announcements
4. Document screen reader behavior for future development
5. Consider user testing with accessibility community

## Resources

- [ARIA Live Regions - MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions)
- [WCAG 2.1 Success Criterion 4.1.3](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
- [Screen Reader Testing Tools](https://webaim.org/articles/screenreader_testing/)
- [Sonner Accessibility Documentation](https://sonner.emilkowal.ski/)
