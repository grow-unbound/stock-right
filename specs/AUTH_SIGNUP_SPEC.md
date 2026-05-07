# StockRight Authentication & Signup Specification

**Version:** 1.0  
**Status:** Ready for Implementation  
**Created:** April 17, 2026

---

## Overview

**Three user creation flows:**
1. **Signup Flow** — New tenant/owner creates account (public signup)
2. **Admin Flow** — Orchestrator creates new tenants via backend/admin panel
3. **Invite Flow** — Existing owner invites staff to warehouse

**OTP Delivery Strategy:**
- **Testing (MVP):** Email OTP (easier to implement, easier to test)
- **Go-Live:** WhatsApp Business OTP (production-ready)
- **Implementation:** Abstract OTP delivery so switching is a config change, not a code change

---

## Part 1: SIGNUP FLOW (New Tenant Creation)

### User Journey

```
1. User visits app → "Create Account" button
2. Signup page shown
3. User fills: Full Name + Phone + Email + Company Name
4. Submit → Backend validates & creates:
   - Tenant (using company_name)
   - User (owner role)
   - Warehouse (NOT created yet)
5. Supabase sends OTP to EMAIL (testing)
6. User enters OTP code
7. OTP verified → Redirect to "Create Warehouse" page
8. User creates first warehouse (name, location, etc.)
9. Redirect to Home (with empty state: "Add your first lot")
```

### Signup Form

#### Form Fields

```
┌────────────────────────────────────────┐
│       Create Your StockRight Account     │
├────────────────────────────────────────┤
│                                        │
│ Full Name *                            │
│ [________________________]             │
│ (e.g., Ravi Kumar)                    │
│                                        │
│ Phone Number *                         │
│ [+91_____________________]            │
│ (e.g., +919876543210)                 │
│                                        │
│ Email Address *                        │
│ [________________________]             │
│ (for OTP during testing)              │
│                                        │
│ Company/Warehouse Name *               │
│ [________________________]             │
│ (e.g., Ravi Cold Storage)             │
│                                        │
│ [ ] I agree to Terms & Privacy Policy │
│                                        │
│        [Create Account]                │
│                                        │
│ Already have account? Log in           │
└────────────────────────────────────────┘
```

#### Field Specs

```
Full Name:
├─ Type: Text input
├─ Validation: Non-empty, min 2 chars, max 100 chars
├─ Placeholder: "e.g., Ravi Kumar"
├─ Required: Yes
└─ Notes: Store as user.full_name

Phone Number:
├─ Type: Tel input with country code
├─ Format: +91 prefix (India)
├─ Validation: Valid Indian phone (10 digits after +91)
├─ Placeholder: "+919876543210"
├─ Required: Yes
└─ Notes: Store as user.phone, also used for WhatsApp OTP later

Email Address:
├─ Type: Email input
├─ Validation: Valid email format
├─ Placeholder: "e.g., ravi@example.com"
├─ Required: Yes (for testing OTP delivery)
├─ Notes: Store as user.email (not auth_user email, separate field)
└─ Future: Use for billing, notifications, password reset

Company Name:
├─ Type: Text input
├─ Validation: Non-empty, min 2 chars, max 100 chars
├─ Placeholder: "e.g., Ravi Cold Storage"
├─ Required: Yes
└─ Notes: Create tenant.name from this

Terms Checkbox:
├─ Type: Checkbox (must be checked to submit)
├─ Text: "I agree to Terms & Conditions and Privacy Policy"
├─ Links: Link to /terms and /privacy
├─ Required: Yes (business compliance)
└─ Notes: Log acceptance in audit trail
```

#### Form Validation Rules

```
Client-side (React Hook Form + Zod):
├─ Full Name: required, min 2, max 100, no special chars (allow space, hyphen)
├─ Phone: required, match regex /^(\+91)[6-9]\d{9}$/ (India only, MVP)
├─ Email: required, valid email format
├─ Company: required, min 2, max 100
└─ Terms: must be checked

Server-side (Supabase + Edge Function):
├─ Validate all fields again
├─ Check email not already in use
├─ Check phone not already in use (per tenant, owner can have multiple accounts)
├─ Create tenant atomically
├─ Create user atomically
├─ Send OTP (or return error if phone/email duplicated)
└─ Log signup attempt to audit trail
```

### OTP Verification Page

#### UI

```
┌────────────────────────────────────────┐
│       Verify Your Phone Number         │
├────────────────────────────────────────┤
│                                        │
│ We sent a code to:                    │
│ ravi@example.com (testing)             │
│                                        │
│ Enter the 6-digit code:               │
│ [__] [__] [__] [__] [__] [__]         │
│  (auto-focus, auto-submit when filled) │
│                                        │
│ Didn't get it? [Resend Code] (30s)    │
│                                        │
│ Wrong email? [Change Email]            │
│                                        │
└────────────────────────────────────────┘
```

#### OTP Specs

```
OTP Generation:
├─ Length: 6 digits (0-9)
├─ Validity: 10 minutes (600 seconds)
├─ Rate limit: 5 attempts, then 5 min lockout
└─ Delivery: Email for testing, WhatsApp for go-live

OTP Input:
├─ 6 separate input fields (standard UX)
├─ Auto-advance between fields
├─ Auto-submit when all 6 digits entered
├─ Show spinner during verification
├─ Clear fields on error

Resend:
├─ Show after 30 seconds
├─ Rate limit: Max 3 resends per signup attempt
├─ Reset timer each time
├─ Show countdown: "Resend in 30s"

Error Handling:
├─ Invalid OTP: "Code is incorrect. Try again."
├─ Expired OTP: "Code expired. Request a new one."
├─ Too many attempts: "Too many attempts. Try again in 5 minutes."
├─ Invalid email: "Email not recognized. Try again or start over."
```

### Backend Flow (Signup)

#### Endpoint: POST /api/auth/signup

```typescript
// Request
{
  full_name: string;       // "Ravi Kumar"
  phone: string;          // "+919876543210"
  email: string;          // "ravi@example.com"
  company_name: string;   // "Ravi Cold Storage"
  agreed_to_terms: boolean;
}

// Response (success)
{
  session_id: string;     // Temporary session
  otp_sent_to: string;    // "ravi@example.com"
  message: "OTP sent. Check your email.";
  next_step: "verify_otp";
}

// Response (error)
{
  error: string;
  code: string;  // "PHONE_EXISTS" | "EMAIL_EXISTS" | "INVALID_PHONE" | etc.
}
```

#### Database Changes (Signup)

```sql
-- Create tenant (company); add audit fields - created_by, updated_at, updated_by
INSERT INTO tenants (id, name, created_by, created_at)
VALUES (gen_random_uuid(), 'Ravi Cold Storage', auth.uid(), now());

-- Create user (owner) auth.users -> public.user_profiles -> public.user_roles 
-- Add created_by, updated_by, created_at, updated_at fields for all tables
INSERT INTO users (
  id, 
  phone,
  email,
  display_name,
  avatar_url,
  is_active,
  created_at,
  updated_at
)
VALUES (
  auth.uid(),  -- From Supabase Auth
  '+919876543210',
  'ravi@example.com',
  'Ravi Kumar',
  '',
  true,
  now(),
  now()
);

INSERT INTO user_roles(
    user_id,
    tenant_id,
    role
)
VALUES(
    auth.uid(),
    tenant.id,
    'OWNER',
);

-- Log signup
INSERT INTO audit_log (warehouse_id, tenant_id, user_id, entity_type, entity_id, action, old_values, new_values, reason, ip_address, created_at)
VALUES (tenant.id, user.id, 'SIGNUP', {...}, now());
```

#### OTP Flow (Testing with Email)

```
1. POST /api/auth/signup
2. Backend:
   ├─ Validate input
   ├─ Check phone/email not duplicate
   ├─ Create tenant
   ├─ Create user
   ├─ Generate OTP (6 digits)
   ├─ Store encrypted/hashed OTP in DB with expiry (10 min)
   ├─ Send OTP via EMAIL (testing)
   │  └─ Email service call:
   │     POST https://api.supabase.com/functions/v1/send-email-otp
   │     {
   │       email: "ravi@example.com",
   │       otp: "123456",
   │       full_name: "Ravi Kumar"
   │     }
   └─ Return session_id + confirmation
3. Frontend: Show OTP page
4. User enters OTP
5. POST /api/auth/verify-otp
   ├─ Verify OTP matches
   ├─ Mark user as verified
   ├─ Create Supabase session
   ├─ Redirect to "Create Warehouse" page
   └─ Log verification success

// Email template (for testing)
Subject: Your StockRight Verification Code
Body:
  Hi Ravi,
  
  Your verification code is: 123456
  
  This code expires in 10 minutes.
  
  If you didn't request this, ignore this email.
  
  —StockRight Team
```

#### Switching to WhatsApp (Go-Live)

```
// Same flow, different delivery method
// In send-otp function:

if (process.env.OTP_PROVIDER === 'EMAIL') {
  // Testing: Email OTP
  await sendEmailOTP(email, otp);
} else if (process.env.OTP_PROVIDER === 'WHATSAPP') {
  // Production: WhatsApp Business API OTP
  await sendWhatsAppOTP(phone, otp);
  // Use Twilio, MessageBird, or WhatsApp Business API
}

// Frontend shows same OTP page
// Just the delivery channel changes
// No code changes needed
```

---

## Part 2: LOGIN FLOW (Existing User)

### User Journey

```
1. User visits app → "Login" button
2. Login page shown
3. User enters phone number
4. Submit → Check phone exists in system
5. Send OTP to EMAIL (testing) or WHATSAPP (go-live)
6. User enters OTP
7. OTP verified → Create Supabase session → Redirect to Home
```

### Login Form

```
┌────────────────────────────────────────┐
│          Log in to StockRight            │
├────────────────────────────────────────┤
│                                        │
│ Phone Number                           │
│ [+91_____________________]            │
│                                        │
│ We'll send a verification code        │
│                                        │
│        [Send OTP]                      │
│                                        │
│ Don't have account? [Create one]      │
│                                        │
└────────────────────────────────────────┘
```

#### Phone Input

```
Type: Tel input with country code
Format: +91 prefix
Validation: Valid Indian phone
Required: Yes
Placeholder: "+919876543210"
```

#### Endpoint: POST /api/auth/login

```typescript
// Request
{
  phone: string;  // "+919876543210"
}

// Response (success)
{
  session_id: string;
  otp_sent_to: string;  // "****@example.com" (masked for privacy)
  message: "OTP sent";
  next_step: "verify_otp";
}

// Response (error)
{
  error: "Phone not found. Create an account?";
  code: "PHONE_NOT_FOUND";
}
```

#### OTP Verification (Same as signup)
- 6-digit OTP input
- 10-minute validity
- 5 attempts limit
- Resend after 30s
- Auto-submit when filled

#### Database Changes (Login)

```sql
-- Lookup user by phone
SELECT user_id, tenant_id FROM users WHERE phone = '+919876543210';

-- Generate OTP
INSERT INTO otp_tokens (
  id, 
  user_id, 
  code, 
  expires_at, 
  attempt_count, 
  created_at
)
VALUES (gen_random_uuid(), user.id, '123456', now() + 10 min, 0, now());

-- Send OTP (email/WhatsApp depending on config)
-- Log login attempt
INSERT INTO audit_log (...) VALUES (...);
```

---

## Part 3: WAREHOUSE CREATION (After Login)

### User Journey

```
1. User logs in successfully
2. First time? Check if user.warehouse_count == 0
3. If yes → Show "Create Your First Warehouse" page
4. User fills: Warehouse Name, Location, etc.
5. Submit → Create warehouse linked to tenant
6. Redirect to Home (with empty lot list + "Add Lot" prompt)
```

### Warehouse Creation Form

```
┌────────────────────────────────────────┐
│   Create Your First Warehouse          │
├────────────────────────────────────────┤
│                                        │
│ Warehouse Name *                       │
│ [________________________]             │
│ (e.g., Main Godown)                   │
│                                        │
│ Location/Address                       │
│ [________________________]             │
│ (e.g., Hyderabad, Telangana)         │
│                                        │
│ Optional: Storage Capacity (tonnes)      │
│ [________________________]             │
│                                        │
│      [Create Warehouse]                │
│                                        │
└────────────────────────────────────────┘
```

#### Form Specs

```
Warehouse Name:
├─ Type: Text input
├─ Validation: Required, min 2, max 100
├─ Placeholder: "e.g., Main Godown"
└─ Required: Yes

Location:
├─ Type: Text input
├─ Validation: Optional, max 200
├─ Placeholder: "e.g., Hyderabad, Telangana"
└─ Required: No

Capacity (optional):
├─ Type: Number input
├─ Validation: Optional, min 1, max 1M
├─ Placeholder: "e.g., 5000 tonnes"
└─ Required: No
```

#### Endpoint: POST /api/warehouses

```typescript
// Request
{
  tenant_id: string;
  name: string;          // "Main Godown"
  location?: string;     // "Hyderabad"
  capacity?: number;     // 5000
}

// Response (success)
{
  warehouse_id: string;
  name: string;
  message: "Warehouse created";
}
```

#### Database Changes


```sql
-- Change capacity_bags to capacity_tonnes
INSERT INTO warehouses (
  id, 
  tenant_id, 
  warehouse_name,
  warehouse_code,
  city,
  capacity_bags,
  created_by, 
  created_at
)
VALUES (
  gen_random_uuid(),
  tenant.id,
  'Main Godown',
  'MAIN',
  'Hyderabad',
  5000,
  auth.uid(),
  now()
);

-- Setup defaults for warehouse settings (recurring yearly rent cutoff: month + day only)
INSERT INTO warehouse_settings (
    id,
    warehouse_id,
    tenant_id,
    blanket_stale_days,
    follow_up_outstanding_days,
    yearly_rent_cutoff_month,
    yearly_rent_cutoff_day,
    grace_period_months,
    created_at,
    updated_at
)
VALUES (
    gen_random_uuid(),
    warehouse.id,
    tenant.id,
    180,
    15,
    5,
    31,
    3,
    now(),
    now()
);

-- Link user to warehouse
INSERT INTO user_warehouse_assignments (
  user_id, 
  warehouse_id, 
  assigned_at
)
VALUES (user.id, warehouse.id, now());
```

---

## Part 4: INVITE FLOW (Owner Adds Staff)

### User Journey

```
1. Owner in App → Settings → "Invite Staff"
2. Show invite form
3. Owner enters: Phone + Name + Role
4. Submit → Check phone not already in warehouse
5. Create user (role based on selection) for this warehouse
6. Send invite link via EMAIL (testing)
7. Staff clicks link, completes signup
8. Staff has access to warehouse
```

### Invite Form

```
┌────────────────────────────────────────┐
│        Invite Staff Member             │
├────────────────────────────────────────┤
│                                        │
│ Warehouse *                            │
│ [Dropdown: Existing Warehouses setup.] │
│                                        │
│ Staff Phone Number *                   │
│ [+91_____________________]             │
│ (e.g., +919876543210)                  │
│                                        │
│ Full Name *                            │
│ [________________________]             │
│ (e.g., Suresh Kumar)                   │
│                                        │
│ Role *                                 │
│ [Dropdown: Manager / Staff / Owner]    │
│                                        │
│      [Cancel] [Send Invite]            │
│                                        │
│ Already invited:                       │
│ ├─ +919988776655 (Ramesh) - Operator   │
│ └─ +919988776666 (Priya) - Manager     │
│                                        │
└────────────────────────────────────────┘
```

#### Invite Endpoint: POST /api/invites

```typescript
// Request
{
  warehouse_id: string;
  phone: string;         // "+919876543210"
  full_name: string;     // "Suresh Kumar"
  role: 'MANAGER' | 'OPERATOR' | 'VIEWER';
}

// Response
{
  invite_id: string;
  invite_link: string;   // https://stockright.com/join?invite=xyz123
  message: "Invite sent to +919876543210";
}
```

#### Invite Link

```
Format: /join?invite_code=ABC123XYZ
When staff clicks:
├─ Prefills name (if already exists)
├─ Prefills phone
├─ Shows role assignment
├─ Staff creates account OR logs in
├─ Auto-added to warehouse with invited role
```

#### Email Template (Invite)

```
Subject: You're invited to join StockRight
Body:
  Hi Suresh,
  
  Ravi Kumar invited you to manage his warehouse in StockRight.
  
  Role: Operator
  
  [Click here to join] (links to /join?invite_code=ABC123XYZ)
  
  Or copy this link:
  https://stockright.com/join?invite_code=ABC123XYZ
  
  This link expires in 7 days.
  
  Questions? Contact the warehouse owner.
  
  — StockRight Team
```

---

## Part 5: ADMIN FLOW (Create New Tenant)

### Who: You (orchestrator) via admin panel

### Journey

```
1. You access admin panel (/admin/tenants)
2. Click "Create New Tenant"
3. Fill: Owner phone, Owner name, Company name
4. Submit → Backend creates tenant + user + sends OTP
5. Owner receives OTP, logs in
```

### Admin Form

```
┌────────────────────────────────────────┐
│     Create New Customer Tenant         │
├────────────────────────────────────────┤
│                                        │
│ Owner Phone Number *                   │
│ [+91_____________________]             │
│                                        │
│ Owner Name *                           │
│ [________________________]             │
│                                        │
│ Company/Warehouse Name *               │
│ [________________________]             │
│                                        │
│       [Create Tenant]                  │
│                                        │
│ Recent Tenants:                        │
│ ├─ Ravi Cold Storage (created 1h ago)  │
│ ├─ Kumar Godown (created 2 days ago)   │
│ └─ ...                                 │
│                                        │
└────────────────────────────────────────┘
```

#### Admin Endpoint: POST /api/admin/tenants

```typescript
// Request (authenticated as admin/orchestrator only)
{
  owner_phone: string;      // "+919876543210"
  owner_name: string;       // "Ravi Kumar"
  company_name: string;     // "Ravi Cold Storage"
}

// Response
{
  tenant_id: string;
  user_id: string;
  message: "Tenant created. OTP sent to +919876543210";
}
```

---

## Part 6: DATA MODEL

### New/Updated Tables
- users table - include email
- warhouses - change capacity_bags to capacity_tonnes
- include id (gen_random_uuid) PK fields in all tables
- include 4 audit fields in all tables - created_at, updated_at, created_by, updated_by
- inlcude new tables as below - auth_tokens, invites

```sql

-- OTP tokens (for testing, can be removed later)
CREATE TABLE auht_tokens (
  id UUID PRIMARY KEY,
  user_id UUID,
  phone TEXT,
  otp_code TEXT NOT NULL, -- store hashed/ecrypted format that is also easy to decrypt
  expires_at TIMESTAMP NOT NULL,
  attempt_count INTEGER DEFAULT 0,
  created_at TIMESTAMP,
  verified_at TIMESTAMP
);

-- Invites (for staff invitations)
CREATE TABLE invites (
  id UUID PRIMARY KEY,
  warehouse_id UUID NOT NULL,
  phone TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL,
  invite_code TEXT UNIQUE,
  expires_at TIMESTAMP,
  accepted_at TIMESTAMP,
  created_by UUID NOT NULL,
  created_at TIMESTAMP
);
```

---

## Part 7: RLS POLICIES

```sql
-- Users can see themselves
CREATE POLICY "Users see own record"
  ON users FOR SELECT
  USING (auth.uid() = auth_id);

-- Users see other users in same tenant
CREATE POLICY "Users see tenant members"
  ON users FOR SELECT
  USING (tenant_id = auth.tenant_id());

-- Warehouse access: Users see warehouses they're assigned to
CREATE POLICY "Users see assigned warehouses"
  ON warehouses FOR SELECT
  USING (
    tenant_id = auth.tenant_id() AND
    id IN (
      SELECT warehouse_id 
      FROM user_warehouse_assignments 
      WHERE user_id = auth.uid()
    )
  );

-- Owner can assign users to warehouses
CREATE POLICY "Owners manage warehouse assignments"
  ON user_warehouse_assignments FOR INSERT
  USING (
    warehouse_id IN (
      SELECT id FROM warehouses 
      WHERE tenant_id = auth.tenant_id()
    )
  );
```

---

## Part 8: OTP DELIVERY ABSTRACTION

### Email (Testing)

```typescript
// packages/shared/api/otp.ts
export async function sendOTP(phone: string, email: string, otp: string) {
  if (process.env.OTP_PROVIDER === 'EMAIL') {
    // Testing: Email OTP
    return await fetch('https://api.supabase.com/functions/v1/send-email-otp', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SUPABASE_TOKEN}` },
      body: JSON.stringify({ email, otp, phone })
    });
  } else if (process.env.OTP_PROVIDER === 'WHATSAPP') {
    // Production: WhatsApp OTP
    return await sendWhatsAppOTP(phone, otp);
  }
}
```

### Environment Config

```bash
# .env.local (testing)
OTP_PROVIDER=EMAIL
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...

# .env.production (go-live)
OTP_PROVIDER=WHATSAPP
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_PHONE=...
```

---

## Part 9: ACCEPTANCE CRITERIA

### Signup Flow
- [ ] Form validates client + server-side
- [ ] Tenant created with company_name
- [ ] User created as OWNER role
- [ ] Email OTP sent (use fake SMTP for testing)
- [ ] OTP verified, session created
- [ ] Warehouse creation page shown
- [ ] User can create first warehouse
- [ ] Redirect to Home after warehouse creation

### Login Flow
- [ ] Phone lookup works
- [ ] OTP sent to registered email
- [ ] OTP verification works
- [ ] Session created, user logged in
- [ ] Redirect to Home page

### Invite Flow
- [ ] Owner can invite staff (form works)
- [ ] Invite email sent with link
- [ ] Staff can click link and join
- [ ] Staff added to warehouse with correct role
- [ ] Staff can see warehouse after invite accepted

### Admin Flow
- [ ] Admin can create new tenant
- [ ] Tenant + user created atomically
- [ ] OTP sent to owner
- [ ] Owner can log in

### Edge Cases
- [ ] Duplicate phone → Error message
- [ ] Duplicate email → Error message
- [ ] Expired OTP → "Request new code"
- [ ] Invalid OTP → "Try again"
- [ ] Phone not found on login → "Create account?"
- [ ] OTP expiry cleanup (nightly job)

---

## Part 10: TESTING CHECKLIST

### Manual Testing (Before QA)
- [ ] Signup with new phone/email
- [ ] Verify email OTP works
- [ ] Create warehouse
- [ ] Log out
- [ ] Log in with same phone
- [ ] Invite staff member
- [ ] Accept invite, verify access
- [ ] Admin create tenant
- [ ] Test with real email (use your email)

### QA Testing
- [ ] All happy paths pass
- [ ] Error messages clear
- [ ] Validation works (bad phone, bad email)
- [ ] Rate limiting works (5 OTP attempts, 5 min lockout)
- [ ] OTP expiry works (10 min expiration)
- [ ] Phone/email uniqueness enforced
- [ ] RLS prevents access across tenants
- [ ] Audit log captures all events

### Device Testing
- [ ] Mobile (320px) - form responsive
- [ ] Tablet (768px) - centered, readable
- [ ] Desktop (1200px) - form not too wide

---

## IMPLEMENTATION TIMELINE

### Milestone 0 - M0
- [ ] Database schema + RLS policies
- [ ] Signup form + validation
- [ ] OTP generation + email sending (testing)
- [ ] OTP verification page
- [ ] Login form + OTP flow
- [ ] Warehouse creation form

### Milestone 1 - M1 (M0 → M1)
- [ ] Invite flow (form + email)
- [ ] Admin panel (create tenant)
- [ ] Session management
- [ ] Logout functionality
- [ ] Error handling + edge cases

### Milestone 2 - M2 (Integration)
- [ ] E2E tests (signup → login → use app)
- [ ] Manual testing with real email
- [ ] Performance testing
- [ ] Security audit

### Milestone 3 - M3 (Go-Live Prep)
- [ ] Switch OTP provider (WhatsApp)
- [ ] Update email templates
- [ ] Documentation for users
- [ ] Staff training

---

**Auth & Signup Spec Complete. Ready for Development.** ✅