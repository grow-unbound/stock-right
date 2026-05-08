/** SecureStore / local persistence for the active warehouse (mobile + any client reads). */
export const ACTIVE_WAREHOUSE_ID_KEY = "active_warehouse_id";

/** HttpOnly cookie on web — set via Server Actions / middleware. */
export const ACTIVE_WAREHOUSE_COOKIE_NAME = "sr_active_warehouse_id";

/** UI language (en | te | hi) — localStorage on web, SecureStore on mobile. */
export const UI_LOCALE_STORAGE_KEY = "sr_ui_locale";
