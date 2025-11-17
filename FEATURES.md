# Cave Schedule - Feature Documentation

## Overview
Cave Schedule is a Next.js booking system for The Cave Golf simulator business. It allows users to book time slots on two golf simulators (East and West) and provides comprehensive admin tools for managing users, payments, and guest fees.

## Technology Stack
- **Framework**: Next.js 16.0.1 with Turbopack
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (for profile pictures)
- **Hosting**: Vercel (golfthecave.ca)
- **Styling**: Tailwind CSS

## User Roles

### Regular Users
- Can book up to 2 hours total (across both simulators)
- Can view and cancel their own bookings
- Can see current week only (today + 6 days)
- Can view their outstanding guest fees balance
- Can change their password
- Can contact admins via contact form

### Admin Users
- All regular user capabilities, plus:
- Can view and cancel ANY user's booking
- Can view bookings from ANY date (past or future)
- Can add guest fees ($20 per guest) to any booking
- Can manage all users (create, edit, delete)
- Can view and manage all outstanding payment balances
- Can record payments (full or partial)
- Can manage user messages and home page announcements
- Can view profile pictures in user management and booking slots
- Full access to settings and admin pages

## Core Features

### 1. Booking System
- **Simulator Selection**: East Sim and West Sim
- **Time Slots**: 6:00 AM - 2:00 AM next day (2-hour blocks)
- **Booking Structure**: Each booking is exactly 2 hours (no longer individual 1-hour slots)
- **Booking Limits**: Maximum 1 booking per user (2 hours total)
- **Timezone**: MST (UTC-7)
- **Visual Indicators**:
  - Gray: Available slots
  - Blue: Booked by others
  - Green: User's own bookings
  - Yellow: Selected (before booking)
  - Past slots (admin only): Gray with reduced opacity
- **Two-Hour System**: When a user selects a time slot, it automatically books both that hour and the next hour as a single 2-hour booking

### 2. Authentication
- Email/password login via Supabase
- "Remember Me" checkbox (checked by default)
  - Checked: Session persists across browser restarts (localStorage)
  - Unchecked: Session clears when browser closes (sessionStorage)
- 10-second timeout protection on auth checks (prevents hanging)
- Automatic session refresh

### 3. Guest Fee Tracking System
**For Admins:**
- "Guest +$20" button on all booked time slots
- Can click multiple times for multiple guests
- Linked to specific booking with date/time
- View all transactions with booking details

**For Users:**
- Outstanding balance displayed prominently on home page
- Shows "Guest Fees Due: $XX.XX" below simulator selection
- **View Details Button**: Opens modal showing itemized guest fee transactions
  - Lists each guest fee with booking date/time and simulator
  - Shows individual amounts (+$20.00 per transaction)
  - Displays total due at bottom
- Only appears when balance > $0
- Updates automatically on login

### 4. Payment Management (Admin Only)
**Access**: Settings → User Payments

**Features**:
- View all users with outstanding balances
- See transaction history for each user:
  - Guest fees with booking date/time/simulator
  - Payments received
  - When transaction was recorded
- Record payments (full or partial amounts)
- Balances calculated automatically from all transactions

**Transaction Types**:
- `guest_fee`: +$20 charge for bringing a guest
- `payment`: Negative amount when user pays
- `adjustment`: Manual corrections (if needed)

### 5. User Management (Admin Only)
**Access**: Settings → Users

**Capabilities**:
- Create new users (name, email, phone, password, role)
- Edit existing users (all fields)
- Upload/manage high-quality profile pictures (max 10MB)
- Delete users (except yourself)
- View profile pictures (square format with click-to-zoom)

**Profile Pictures**:
- Stored in Supabase Storage bucket: `profile-pictures`
- Public read access, admin-only write/update/delete
- Displayed in:
  - Users management table (48x48px thumbnails)
  - Booking slots for admins (40x40px)
  - Click to view full size in modal

### 6. Admin Date Navigation
**Purpose**: Review camera footage and add guest fees retroactively

**Controls** (Admin-only):
- **Previous Week / Next Week** buttons
- **Date Picker** input for any specific date
- **Today** button to return to current date
- **7-Day View** centered around selected date

**Past Slot Access**:
- Admins can see ALL time slots (past and future)
- Past slots shown with gray background and reduced opacity
- Full functionality maintained (can add guest fees, cancel bookings)

### 7. Contact System
**For Users**:
- Contact form with:
  - Issue type selection
  - Subject and message
  - Optional photo upload (stored in Supabase Storage)
- Accessible from navbar: Contact Us

**For Admins**:
- View all submitted messages
- Mark as read/unread
- Mark as resolved/unresolved
- Add admin notes
- Filter and sort messages
- Access via Settings → User Messages

### 8. Home Page Announcements
**For Admins** (Settings → Home Page Messages):
- Create rich text announcements
- Activate/deactivate messages
- Displayed on home page for all users
- Yellow alert boxes with HTML formatting support

### 9. Membership Inquiry System

**Public Login Page Features:**
- Displays membership information for non-members:
  - $400/year membership cost
  - $20 guest fee policy
- **Membership Inquiry Form**:
  - Name, email, phone (optional), and message fields
  - Available to non-authenticated users
  - Stores inquiries in dedicated `membership_inquiries` table (no foreign key constraints)

**Admin Management** (Settings → Membership Inquiries):
- View all inquiries with filtering:
  - All, Unread, Read, Resolved
- Auto-marks as read when viewed
- Add admin notes
- Mark as resolved
- Delete inquiries
- Green dot indicator for new/unread inquiries
- Click-through to detailed view modal

### 10. Bookings Report (Admin Only)

**Access**: Settings → Bookings Report (via dropdown menu)

**Features**:
- Date range selection for reporting period
- Lists all bookings within selected range
- Shows user name, simulator, date/time
- Useful for reviewing booking patterns and usage

### 11. Membership Report (Admin Only)

**Access**: Settings → Membership Report

**Features**:
- View membership status for all users
- Track active and expired memberships
- Monitor membership renewal dates

### 12. Profile Management
**All Users**:
- Change password functionality
- Auto-logout after successful password change
- 3-second timeout protection (prevents hanging)
- Accessible from user dropdown: Profile

## Database Structure

### Tables

#### `profiles`
- `id` (UUID, primary key)
- `name` (text)
- `email` (text)
- `phone` (text)
- `role` (text: 'user' or 'admin')
- `profile_picture_url` (text, nullable)
- `created_at` (timestamp)

#### `bookings`
- `id` (bigint, primary key)
- `user_id` (UUID, foreign key to profiles)
- `simulator` (text: 'east' or 'west')
- `start_time` (timestamp)
- `end_time` (timestamp)
- `created_at` (timestamp)

#### `user_transactions`
- `id` (bigint, primary key)
- `user_id` (UUID, foreign key to profiles)
- `booking_id` (bigint, foreign key to bookings, nullable)
- `type` (text: 'guest_fee', 'payment', 'adjustment')
- `amount` (decimal: positive for charges, negative for payments)
- `description` (text)
- `created_by` (UUID, admin who created transaction)
- `created_at` (timestamp)

#### `contact_messages`
- `id` (bigint, primary key)
- `user_id` (UUID)
- `user_name` (text)
- `user_email` (text)
- `user_phone` (text)
- `issue_type` (text)
- `subject` (text)
- `message` (text)
- `photo_url` (text, nullable)
- `submitted_at` (timestamp)
- `is_read` (boolean)
- `is_resolved` (boolean)
- `admin_notes` (text, nullable)

#### `tournament_messages`
- `id` (UUID, primary key)
- `message` (text, HTML content)
- `is_active` (boolean)
- `created_at` (timestamp)
- `updated_at` (timestamp)

#### `membership_inquiries`
- `id` (bigint, primary key, auto-generated)
- `name` (text, not null)
- `email` (text, not null)
- `phone` (text, nullable)
- `message` (text, not null)
- `submitted_at` (timestamptz, default now())
- `is_read` (boolean, default false)
- `is_resolved` (boolean, default false)
- `admin_notes` (text, nullable)

### Storage Buckets

#### `profile-pictures`
- Public read access
- Admin-only write/update/delete
- Max file size: 10MB
- No compression (maintains high quality)

#### `message-photos`
- Public read access
- User write access for their own photos
- For contact form attachments

## Key Pages

### Public/User Pages
- `/login` - Authentication with Remember Me, membership info, and inquiry form
- `/` - Home page with simulator selection, bookings, guest fees balance with View Details modal
- `/profile` - Password change functionality
- `/contact` - Contact form for support requests

### Admin Pages
- `/settings` - Admin dashboard with cards for all admin features
- `/users` - User management (create, edit, delete, profile pictures)
- `/messages` - View and manage contact form submissions
- `/tournament-messages` - Manage home page announcements
- `/payments` - View outstanding balances and manage payments
- `/membership-inquiries` - View and manage public membership inquiries
- `/bookings-report` - View booking history by date range
- `/membership-report` - View membership status for all users

## API Endpoints

### `/api/bookings`
- **GET**: Fetch bookings for specific simulator and date
- **POST**: Create new booking
- **DELETE**: Cancel booking (admin can cancel any, users only their own)

### `/api/users`
- **GET**: Fetch all users (admin only)
- **POST**: Create new user (admin only)
- **PUT**: Update user details including profile picture (admin only)
- **DELETE**: Delete user (admin only, cannot delete self)

### `/api/transactions`
- **GET**:
  - `?action=balances` - Get all users with outstanding balances (admin only)
  - `?userId={id}` - Get transaction history for user (admin or user viewing own)
- **POST**: Add guest fee, payment, or adjustment (admin only)

### `/api/tournament-messages`
- **GET**: Fetch all messages (public)
- **POST**: Create message (admin only)
- **PUT**: Update message (admin only)
- **DELETE**: Delete message (admin only)

### `/api/public/membership-inquiry`
- **POST**: Submit new membership inquiry (no auth required)
  - Stores in `membership_inquiries` table
  - No foreign key constraints (allows public submission)

### `/api/admin/membership-inquiries`
- **GET**: Fetch all inquiries (admin only)
- **PATCH**: Update inquiry status (admin only)
- **DELETE**: Delete inquiry (admin only)

### `/api/admin/bookings-report`
- **GET**: Fetch bookings within date range (admin only)
  - Query params: `startDate`, `endDate`
  - Returns bookings with associated user profiles

## Security Features

### Row Level Security (RLS)
- All tables use Supabase RLS policies
- Users can only view/edit their own data
- Admins have full access via admin client
- Storage buckets have appropriate access policies

### Authentication Timeouts
- 10-second timeout on all auth checks
- Prevents infinite "Loading..." screens
- Auto-redirect to login on timeout
- Applied to all protected pages

### Admin Client Usage
- Server-side admin operations use `createAdminSupabaseClient()`
- Bypasses RLS for admin operations
- Used for:
  - User management (create, update, delete)
  - Deleting any booking
  - Transaction management
  - Viewing all user data

## Recent Improvements

### Performance
- Fixed authentication hanging issues across all pages
- Added proper timeout handling and cleanup
- Improved error handling and logging

### UI/UX
- Fixed layout shifts when messages appear
- Removed navbar profile pictures (kept only in admin views)
- Simplified guest fees display (removed subtext)
- Added proper loading states
- Square profile pictures with rounded corners
- Responsive design for all admin controls

### Features Added (Chronological)
1. Password change functionality for all users
2. User editing capability (name, email, phone, role)
3. Terms & Conditions PDF link in navbar
4. User dropdown menu in navbar (replaced greeting)
5. Tournament message filtering (hide inactive)
6. High-quality profile pictures system
7. Guest fee tracking ($20 per guest)
8. User payments management page
9. Outstanding guest fees display on home page
10. Remember Me checkbox on login
11. Admin date navigation (view any past/future date)
12. Extended time slots to 2:00 AM (midnight, 1 AM, 2 AM slots)
13. Changed booking system from 2 individual 1-hour slots to single 2-hour bookings
14. Bookings report with date range filtering
15. Membership inquiry system for non-members on login page
16. Guest fee details modal with itemized transaction breakdown

## Configuration

### Environment Variables
Hardcoded in `src/lib/supabase.ts` due to Next.js 16.0.1/Turbopack limitations:
- `SUPABASE_URL`: https://uxtdsiqlzhzrwqyozuho.supabase.co
- `SUPABASE_ANON_KEY`: (in code)

### Database Migrations
Located in `supabase/migrations/`:
- `20250112_add_profile_pictures.sql` - Profile pictures feature
- `20250112_add_guest_fees.sql` - Guest fee tracking system
- `20251116_add_membership_inquiries.sql` - Membership inquiry table (no foreign key constraints)

Run migrations via Supabase Dashboard SQL Editor.

## Known Limitations

1. **File Uploads**: Limited to 10MB for profile pictures
2. **Booking Limit**: Hard-coded 1 booking (2 hours) per user
3. **Time Slots**: Fixed 2-hour blocks, 6 AM - 2 AM next day
4. **Timezone**: Fixed to MST (UTC-7)
5. **Week View**: Regular users see 7 days (today + 6), admins see 7 days centered around selected date
6. **Membership Inquiries**: No automated email notifications to admins (manual checking required)

## Support & Maintenance

### Deployment
- Auto-deploys from `main` branch via Vercel
- Production URL: golfthecave.ca
- GitHub Repository: rbohne/simschedule-nextjs

### Local Development
```bash
cd simschedule-nextjs
pnpm install
pnpm run dev
```

### Testing Admin Features
- Create admin user via Supabase dashboard (set `role` to 'admin' in profiles table)
- Or use existing admin account

## Future Enhancement Ideas

1. Email notifications for bookings
2. Calendar view option
3. Recurring bookings
4. Export payment reports
5. Multi-timezone support
6. SMS reminders
7. Equipment/club rental tracking
8. League/tournament management
9. Customer loyalty program
10. Integration with payment processors (Stripe, Square)

---

**Last Updated**: November 16, 2025
**Version**: 1.1
**Maintained by**: Claude Code
