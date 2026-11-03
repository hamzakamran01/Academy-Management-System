-- ============================================================================
-- KMS Campusly · Add a second Owner (super admin): Kamran · 0302 4648462
-- ============================================================================
-- Run once in the Supabase SQL editor. Safe to re-run:
--   • If the phone number already has an account (e.g. as a parent or teacher),
--     the Owner role is added to that same account — nothing is duplicated.
--   • Each run invalidates earlier unused setup links for this number and
--     makes a fresh one (valid 7 days).
--
-- After running, copy the `setup_link` from the result, replace
-- https://YOUR-APP-DOMAIN with the real site address, and send it to Kamran.
-- He opens it, creates his password, and from then on signs in with
-- 0302 4648462 + that password.
--
-- Owner passwords must have: at least 8 characters, a letter, a number and a
-- symbol (like @ # $ ! *), and must not contain the phone number.
-- ============================================================================

BEGIN;

WITH
  acad AS (
    SELECT id FROM academy ORDER BY created_at LIMIT 1
  ),
  upsert_user AS (
    INSERT INTO users (academy_id, phone, name)
    SELECT id, '+923024648462', 'Kamran' FROM acad
    ON CONFLICT (phone) DO UPDATE SET status = 'active', updated_at = now()
    RETURNING id
  ),
  grant_role AS (
    INSERT INTO role_assignments (user_id, role, active)
    SELECT id, 'super_admin', true FROM upsert_user
    ON CONFLICT (user_id, role) DO UPDATE SET active = true, updated_at = now()
    RETURNING user_id
  ),
  close_old_links AS (
    UPDATE setup_tokens SET used_at = now()
    WHERE user_id = (SELECT id FROM upsert_user) AND used_at IS NULL
    RETURNING id
  ),
  -- 32 random bytes, URL-safe, exactly like the app's newToken(); only its SHA-256 is stored.
  token AS (
    SELECT rtrim(translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_'), '=') AS raw
  ),
  new_link AS (
    INSERT INTO setup_tokens (user_id, token_hash, expires_at, created_by)
    SELECT
      (SELECT id FROM upsert_user),
      encode(digest(token.raw, 'sha256'), 'hex'),
      now() + interval '7 days',
      (SELECT ra.user_id FROM role_assignments ra
         JOIN users u ON u.id = ra.user_id
        WHERE ra.role = 'super_admin' AND ra.active AND u.phone <> '+923024648462'
        ORDER BY ra.created_at LIMIT 1)
    FROM token
    RETURNING expires_at
  )
SELECT
  'Kamran'                                              AS name,
  '0302 4648462'                                        AS phone,
  (SELECT count(*) FROM grant_role)                     AS owner_role_granted,
  (SELECT count(*) FROM close_old_links)                AS old_links_closed,
  'https://YOUR-APP-DOMAIN/setup/' || (SELECT raw FROM token) AS setup_link,
  (SELECT expires_at FROM new_link)                     AS link_expires_at;

COMMIT;

-- Check (optional):
-- SELECT u.name, u.phone, ra.role, ra.active, u.password_hash IS NOT NULL AS has_password
-- FROM users u JOIN role_assignments ra ON ra.user_id = u.id
-- WHERE u.phone = '+923024648462';
