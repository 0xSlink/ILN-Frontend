# Screen Reader Testing Guide for Toast & Notifications

## Overview

This guide provides practical steps for testing the accessibility of toast notifications and the notification center with screen readers. The goal is to verify that screen reader users receive appropriate announcements when toasts appear and new notifications arrive.

## Testing Environment Setup

### macOS (VoiceOver)

1. **Enable VoiceOver**:

   - Press `Cmd + F5` or go to System Settings > Accessibility > VoiceOver
   - Or use `Cmd + Option + F5` for quick toggle

2. **VoiceOver Useful Commands**:
   - `Ctrl + Option + Right/Left Arrow`: Move to next/previous item
   - `Ctrl + Option + Shift + Down Arrow`: Read from current position
   - `Ctrl + Option + A`: Read all content from cursor position
   - `Ctrl + Option + Space`: Activate/click current item

### Windows (NVDA)

1. **Install NVDA**:

   - Download from [nvaccess.org](https://www.nvaccess.org/download/)
   - Free, open-source screen reader

2. **NVDA Useful Commands**:
   - `NVDA + Down Arrow`: Read current line
   - `NVDA + Up Arrow`: Read previous line
   - `NVDA + B`: Read next button
   - `NVDA + F`: Read next form field

### Web Browsers

- **Chrome**: Works well with both VoiceOver and NVDA
- **Safari**: Best with VoiceOver on macOS
- **Firefox**: Good compatibility with NVDA

## Testing Scenarios

### 1. Toast Notification Testing

**Test Case: Success Toast Announcement**

1. Navigate to any page that can trigger a toast (e.g., invoice funding)
2. Activate the toast trigger (button click, form submission)
3. **Expected Result**: Screen reader should announce:
   - Toast title: "Invoice funded"
   - Toast message: "Invoice #123 has been funded successfully"
   - Announcement should occur without requiring user focus

**Test Case: Error Toast Announcement**

1. Trigger an error toast (e.g., transaction failure)
2. **Expected Result**: Screen reader should announce error immediately
   - Error toasts may use assertive politeness (`aria-live="assertive"`)
   - Should interrupt other speech if necessary

**Test Case: Toast Dismissal**

1. Trigger a toast
2. Wait for auto-dismissal (5 seconds) or manually dismiss
3. **Expected Result**: No duplicate or confusing announcements on dismissal

### 2. Notification Center Testing

**Test Case: New Notification Arrival**

1. Have the notification system running (requires wallet connection)
2. Simulate or wait for a new notification (invoice settled, proposal created)
3. **Expected Result**: Screen reader should announce:
   - "1 new notification" (or count if multiple)
   - Announcement should be polite, not interruptive

**Test Case: Opening Notification Drawer**

1. Navigate to notification bell button
2. **Expected Result**: Button should announce:
   - "Open notifications" or "Open notifications, 3 unread"
   - Button state should be clear
3. Activate the button to open drawer
4. **Expected Result**:
   - Focus should move into the drawer
   - Drawer should announce its purpose: "Notification centre"

**Test Case: Reading Notifications**

1. Open notification drawer
2. Navigate through notifications
3. **Expected Result**:
   - Each notification should be readable
   - Unread status should be indicated
   - Links should be properly described

## Common Issues to Watch For

### Duplicate Announcements

- **Problem**: Screen reader announces same thing multiple times
- **Cause**: Multiple ARIA live regions updating with same content
- **Solution**: Ensure only one live region announces each update

### Missing Announcements

- **Problem**: Screen reader doesn't announce toast/notification
- **Cause**: Live region not updated or wrong politeness level
- **Solution**: Verify `aria-live` attribute and content updates

### Incorrect Focus Management

- **Problem**: Focus doesn't move to interactive elements
- **Cause**: Missing `tabindex` or focus management
- **Solution**: Ensure focus moves to toast action buttons

### Timing Issues

- **Problem**: Announcement happens too fast/slow
- **Cause**: Incorrect timing for screen reader processing
- **Solution**: Allow 500ms-1000ms for announcements to be processed

## Automated Testing Commands

While manual testing is essential, automated checks can catch regressions:

```bash
# Run accessibility tests
pnpm test -- --run "accessibility"

# Run specific toast/notification tests
pnpm test -- --run "ToastNotification"

# Check for WCAG violations
pnpm test -- --run "a11y"
```

## Testing Checklist

### Toast System

- [ ] Success toasts announce to screen readers
- [ ] Error toasts announce immediately (assertive)
- [ ] Toast content is descriptive and clear
- [ ] Auto-dismissal doesn't cause announcement issues
- [ ] Manual dismissal works with keyboard
- [ ] Focus moves to toast action buttons (if present)
- [ ] Multiple toasts don't cause announcement conflicts

### Notification System

- [ ] New notifications announce arrival count
- [ ] Notification bell has proper ARIA label
- [ ] Bell indicates unread count in label
- [ ] Drawer opens with proper focus management
- [ ] Notifications are readable in drawer
- [ ] Mark as read functions are accessible
- [ ] Drawer closes with proper focus return

### General Accessibility

- [ ] Color contrast meets WCAG AA standards
- [ ] No animation-induced seizures (flashing)
- [ ] Respects `prefers-reduced-motion`
- [ ] Keyboard navigation works completely
- [ ] No keyboard traps
- [ ] Proper heading structure
- [ ] Images have alt text

## Troubleshooting

### VoiceOver Not Announcing

1. Check Console for errors
2. Verify `aria-live` region exists in DOM
3. Ensure region content actually changes
4. Check for `aria-hidden="true"` on parent elements

### NVDA Issues

1. Ensure NVDA is in browse mode (not forms mode)
2. Check for `role` and `aria-live` attributes
3. Verify content is text (not React components)

### General Debugging

```javascript
// Debug ARIA live regions
console.log('Live regions:', document.querySelectorAll('[aria-live]'));
console.log('Toast region:', document.getElementById('toast-live-region'));

// Check screen reader text
console.log('Screen reader text:', document.querySelector('.sr-only')?.textContent);
```

## Resources

- [WebAIM Screen Reader Survey](https://webaim.org/projects/screenreadersurvey9/)
- [Deque University: Screen Reader Testing](https://dequeuniversity.com/screenreaders/)
- [A11Y Project: Testing with Screen Readers](https://www.a11yproject.com/resources/#testing-with-screen-readers)
- [MDN: ARIA Live Regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions)

## Test Results Template

```markdown
# Accessibility Test Results

**Date**: [Date]
**Tester**: [Name]
**Screen Reader**: [VoiceOver/NVDA/JAWS]
**Browser**: [Chrome/Safari/Firefox]

## Toast System

- Success toast announcement: [PASS/FAIL]
- Error toast announcement: [PASS/FAIL]
- Toast dismissal: [PASS/FAIL]
- Focus management: [PASS/FAIL]

## Notification System

- New notification announcement: [PASS/FAIL]
- Notification drawer: [PASS/FAIL]
- Notification reading: [PASS/FAIL]

## Issues Found

1. [Description of issue]
2. [Description of issue]

## Recommendations

1. [Suggested fix]
2. [Suggested fix]
```
