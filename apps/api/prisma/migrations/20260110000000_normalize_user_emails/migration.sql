-- The API now lowercases emails on register/login. Bring existing rows in
-- line so those users can still sign in. If two accounts differ only by
-- case, the unique index makes this fail and the deploy is rejected (the
-- previous release keeps running) — that case must be resolved by hand,
-- never silently merged.
UPDATE "users" SET "email" = lower(trim("email")) WHERE "email" <> lower(trim("email"));
