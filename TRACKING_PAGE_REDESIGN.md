# Tracking Page Redesign

## Design Updates

### Centered Layout
- Max width: 700px
- Content centered with `alignSelf: 'center'`
- All headers centered
- Consistent with landing page design

### Brand Identity
- "wohl" title at top (36px, orange)
- Maintains brand consistency across pages

### Headers
- **Page Title:** "Track Your Day" (28px, centered)
- **Date:** Full format (e.g., "Saturday, February 28") - 15px, gray
- **Section Titles:** 20px, centered, semi-bold

### Prominent Analysis Button
**Design:**
- Large blue button (#4a90e2)
- Beaker icon (28px) + "Run Analysis" text
- Horizontal layout with icon and text
- Font size: 18px, bold
- Padding: 32px horizontal, 20px vertical
- Border radius: 16px
- Strong blue shadow (6px offset, 40% opacity)
- Elevated appearance (elevation: 6)

**Visual Impact:**
- Most prominent button on page
- Blue matches hypothesis box from landing page
- Icon makes purpose immediately clear
- Shadow creates depth and draws attention

### Beaker Icon Component
- Custom SVG component
- Scientific beaker illustration
- Configurable size and color
- Clean, professional design
- Represents analysis/testing

### Color Scheme
- **Primary (Blue):** #4a90e2 - Analysis button
- **Accent (Orange):** #f55e61 - Brand title
- **Background:** #ffffff
- **Text:** #1a1a1a (primary), #666666 (secondary)

### Spacing
- Container padding: 24px horizontal, 40px vertical
- Section gaps: 32px
- Element gaps: 16px
- Consistent with landing page

## Components Added
- `BeakerIcon.tsx` - SVG beaker icon component
  - Uses react-native-svg
  - Customizable size and color
  - Clean scientific aesthetic

## Visual Hierarchy
1. "wohl" brand (36px, orange)
2. Page title (28px, centered)
3. Analysis button (large, blue, with icon)
4. Section titles (20px, centered)
5. Content (activities, ratings, etc.)

## Professional Touches
- Centered, magazine-style layout
- Consistent branding with landing page
- Prominent call-to-action for analysis
- Scientific icon reinforces data-driven approach
- Blue shadow creates depth
- Clean, spacious design
