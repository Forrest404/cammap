# Migrations

Schema changes land here as `NNN_name.sql` **and** as the same block in
`backend/schema.sql`, so that a database built fresh from `schema.sql` and a
database upgraded by running these in order end up identical. That duplication
is deliberate: it is what lets a new Supabase project be stood up in one paste
without replaying six months of history.

**Nothing in this repository applies them.** There is no migration runner, no
CI step, no script that connects to the database. They are run by hand, in the
Supabase SQL editor, in numerical order, and then `backend/seed.sql` is re-run
afterwards so the record and the table agree again.

## What is applied

| Migration | What it does | Applied? |
| --- | --- | --- |
| `001_periods` | `cameras.periods` jsonb, keyed by the period a source gives; `deployments` is the sum | no |
| `002_source` | `cameras.source_label` and `source_url` — where a row came from | no |
| `003_approximate` | `cameras.approximate` boolean, for a position given to a street rather than a pole | no |
| `004_moderation_log` | `moderation_log`, one row per thing a moderator does | no |
| `005_edit_camera` | `edit_camera` / `moderate_edit_camera`; leaves `seed_key` alone | no |
| `006_merge_cameras` | `merge_cameras` / `moderate_merge_cameras`; nothing is deleted | no |
| `007_leaderboard_opt_out` | `profiles.show_on_leaderboard`, in the three view definitions | no |
| `008_delete_account` | `delete_my_account()` — the caller deletes themselves | no |
| `009_pending_near` | `pending_near(lat, lon)` → `(found, days_ago)`, granted to `anon` | no |
| `010_no_video` | video refused in the `mime` check and in the bucket | no |
| `011_pending_near_cell` | `pending_near` answers per 0.001° cell, not per circle | no |
| `012_cameras_public` | the `cameras_public` view; `anon` loses the table | no |
| `013_in_city` | `in_city(lat, lon)` as SQL's one copy of the city's box | no |

Keep this table honest — it is the only record of what the live database has
actually had run against it, and several comments in `frontend/` describe
fallback code that exists purely because a migration here has not been applied
yet. `viewMissing()` in `frontend/shared.js` is the clearest example: it exists
for 012, and should be deleted once 012 is run.

## Writing a new one

1. Write `backend/migrations/NNN_name.sql`, with a header saying what it adds
   and why, in the voice of the ones already here.
2. Paste the same block into `backend/schema.sql`, in the place it belongs, so
   a fresh build gets it too.
3. Add a row to the table above.
4. If it changes a column the map reads, add that column to the end of the
   `cameras_public` column list as well — a column on `cameras` is not public
   until it is in the view.
