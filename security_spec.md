# Security Specification - SIAKAD Absensi

## Data Invariants
- An attendance record must have a valid ID and timestamp.
- An activity log must have a timestamp and describe an action.

## The "Dirty Dozen" Payloads
1. **ID Poisoning**: Attempt to create a record with a 2KB string as ID.
2. **Identity Spoofing**: User A tries to write a log claiming to be User B.
3. **Type Mismatch**: Sending a string for the `id` of an ActivityLog (should be number).
4. **Shadow Fields**: Adding `isVerified: true` to a record.
5. **Unauthorized Read**: Unauthenticated user trying to read logs.
6. **Malicious Update**: User trying to change the `timestamp` of an existing record.
7. **Size Attack**: Sending a 2MB string as `detail` in an activity log.
8. **Invalid Enum**: Setting `type` to `alien` in AttendanceRecord.
9. **Timestamp Spoofing**: Sending a future timestamp.
10. **Orphaned Write**: (Not applicable here as we don't have deep relations).
11. **PII Leak**: (We store names and IDs, which should be protected).
12. **State Shortcutting**: (Not applicable as records are static snapshots).

## Test Runner (Conceptual)
Verify that all the above return `PERMISSION_DENIED`.
