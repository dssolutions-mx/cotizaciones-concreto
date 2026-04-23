# Quick Reference - Migration Execution Checklist

## 📋 Pre-Execution (Do This First)

- [ ] Read `migration_update_summary.md` for overview
- [ ] Read `supabase_migration_plan_corrected.md` for detailed SQL
- [ ] Read `edge_function_update_guide.md` for edge function changes
- [ ] Schedule migration during off-peak hours
- [ ] Notify team of planned maintenance window
- [ ] Ensure Supabase dashboard access (for backup restore if needed)

---

## 🔧 Migration Execution (Run in Order)

### Phase 0: Validation
- [ ] Run Step 0.1: Validate current state
- [ ] Run Step 0.2: Verify credit webhooks exist
- [ ] ⚠️ If validation fails, STOP and fix issues

### Phase 1: Schema Changes (5 min)
- [ ] Create `client_portal_users` table
- [ ] Add columns to `clients` table
- [ ] Add columns to `orders` table
- [ ] Add `is_portal_user` to `user_profiles`
- [ ] Create `order_approval_history` table (optional)

### Phase 2: Functions (3 min)
- [ ] **CRITICAL:** Run `SET ROLE postgres;`
- [ ] Create `is_client_executive()`
- [ ] Create `get_client_user_permissions()`
- [ ] Create `user_has_client_permission()`
- [ ] Create `get_user_clients()`
- [ ] Update `current_user_is_external_client()`
- [ ] **CRITICAL:** Run `RESET ROLE;`

### Phase 3: Triggers (3 min)
- [ ] Create `update_updated_at_column()`
- [ ] Create `set_order_client_approval_status()` trigger
- [ ] **NEW:** Update `handle_credit_validation_webhook_insert()`
- [ ] **NEW:** Update `handle_credit_validation_webhook_update()`
- [ ] Create `log_order_approval_action()` trigger (optional)

### Phase 4: RLS Policies (5 min)
- [ ] Drop old `external_client_clients_read` policy
- [ ] Drop old `external_client_orders_read` policy
- [ ] Create new `client_portal_users` policies (5 policies)
- [ ] Create new `external_client_clients_read_multi_user`
- [ ] Create new `external_client_orders_read_multi_user`
- [ ] Create new `external_client_orders_insert`
- [ ] Create new `external_client_orders_update`
- [ ] Create `order_approval_history` policies (2 policies)

### Phase 5: Indexes (3 min)
- [ ] Create indexes on `client_portal_users`
- [ ] Create indexes on `orders` approval columns
- [ ] Run `ANALYZE` on all modified tables

### Phase 6: Data Migration (2 min)
- [ ] Migrate existing portal users to junction table
- [ ] Update existing orders approval status
- [ ] Update user profiles `is_portal_user` flag
- [ ] Verify migration counts

### Phase 7: Validation (5 min)
- [ ] Verify all portal users migrated
- [ ] Verify order approval status distribution
- [ ] Verify indexes created
- [ ] Test helper functions
- [ ] Verify no orphaned records
- [ ] Verify trigger execution order
- [ ] Verify old policies dropped
- [ ] Verify function security modes

---

## 🚀 Post-Migration (After SQL Complete)

### Edge Function Update (Manual)
- [ ] Update `credit-validation-notification` edge function
- [ ] Add handling for `type === 'client_approved_order'`
- [ ] Deploy edge function update
- [ ] Test edge function receives webhooks

### Application Updates
- [ ] Deploy frontend changes (if any)
- [ ] Update API endpoints (if any)
- [ ] Clear any application caches

---

## ✅ Smoke Tests (Before Announcing)

### Critical Validation: Internal Staff Configuration
- [ ] Run validation query to check is_portal_user flags
- [ ] Verify ALL sales agents have `is_portal_user = false`
- [ ] Verify ONLY external clients have `is_portal_user = true`
- [ ] ⚠️ If any internal staff marked as portal users, FIX IMMEDIATELY

```sql
-- Run this first!
SELECT role, is_portal_user, COUNT(*)
FROM user_profiles
GROUP BY role, is_portal_user
ORDER BY role;
-- EXPECTED: Only EXTERNAL_CLIENT should have true values
```

### Test 1: Internal Staff Order (CRITICAL - Must Test First)
- [ ] Create order as internal staff
- [ ] Verify `client_approval_status = 'not_required'`
- [ ] Verify credit validators notified immediately

### Test 2: Client Executive Order
- [ ] Create order as existing portal user (executive)
- [ ] Verify `client_approval_status = 'not_required'`
- [ ] Verify credit validators notified immediately

### Test 3: Client Approval Flow (Critical Test)
- [ ] Set test client `requires_internal_approval = true`
- [ ] Create test non-executive portal user
- [ ] Create order as non-executive user
- [ ] Verify `client_approval_status = 'pending_client'`
- [ ] Verify credit validators NOT notified yet
- [ ] Approve order as executive user
- [ ] Verify `client_approval_status = 'approved_by_client'`
- [ ] Verify credit validators notified with `client_approved_order`
- [ ] Complete credit validation normally

### Test 4: RLS Policies
- [ ] Login as portal user
- [ ] Verify can see only their clients
- [ ] Verify can see only their client's orders
- [ ] Verify can create order (if has permission)
- [ ] Logout and verify internal staff access unchanged

### Test 5: Edge Function
- [ ] Check edge function logs
- [ ] Verify it receives `new_order` type
- [ ] Verify it receives `client_approved_order` type
- [ ] Verify credit validators receive emails/notifications

---

## 🔴 Rollback (If Needed)

### Quick Rollback
- [ ] Run rollback SQL from migration plan
- [ ] Revert edge function to previous version
- [ ] Restore from Supabase dashboard backup if needed
- [ ] Notify team migration rolled back

### Verify Rollback
- [ ] Test internal staff can create orders
- [ ] Test existing portal users can access system
- [ ] Test credit validation notifications work

---

## 📊 Monitoring (First 24-48 Hours)

### Watch These Metrics:
- [ ] Credit validation notification delivery rate
- [ ] Order creation success rate
- [ ] Portal user login success rate
- [ ] Database query performance (especially RLS policies)
- [ ] Edge function error rate

### Alert Conditions:
- Credit notification delivery drops below 95%
- Order creation errors increase
- Portal user authentication failures
- Query times exceed 500ms
- Edge function errors exceed 1%

---

## 📞 Emergency Contacts

**If critical issues arise:**
1. Roll back immediately (see rollback section)
2. Contact: [Your team lead/senior developer]
3. Check Supabase dashboard for system status
4. Review edge function logs for webhook errors

---

## 📝 Post-Deployment Tasks

### Within 1 Week:
- [ ] Monitor metrics above
- [ ] Review any error logs
- [ ] Collect feedback from credit validators
- [ ] Collect feedback from portal users (if any tested)

### Within 1 Month:
- [ ] Remove `portal_user_id` column from clients (after confirming everything works)
- [ ] Document any issues encountered and solutions
- [ ] Update team documentation with new approval workflow
- [ ] Consider removing old backup tables (if created manually)

---

## 🎯 Success Criteria

Migration is successful when:

✅ All validation checks pass  
✅ Internal staff workflow unchanged  
✅ Existing portal users can login and create orders  
✅ Credit validators receive notifications correctly  
✅ New client approval workflow works for test client  
✅ No errors in edge function logs  
✅ Performance is acceptable (< 200ms for queries)  
✅ RLS policies working correctly  
✅ Zero data loss or corruption  

---

## 🔗 Related Documents

1. **`supabase_migration_plan_corrected.md`** - Complete SQL scripts
2. **`edge_function_update_guide.md`** - Edge function changes
3. **`migration_update_summary.md`** - What changed and why

---

## ⏱️ Estimated Timeline

```
00:00 - Start validation
00:02 - Start Phase 1 (Schema)
00:07 - Start Phase 2 (Functions)
00:10 - Start Phase 3 (Triggers)
00:13 - Start Phase 4 (RLS)
00:18 - Start Phase 5 (Indexes)
00:21 - Start Phase 6 (Migration)
00:23 - Start Phase 7 (Validation)
00:28 - Deploy edge function
00:30 - Run smoke tests
00:45 - Monitor and verify
01:00 - Announce completion
```

**Total: ~1 hour including testing**

---

## 💡 Pro Tips

1. **Run validation first** - saves time if there are issues
2. **Set role before functions** - prevents infinite recursion
3. **Test on staging** - catches 90% of issues
4. **One client at a time** - enable approval gradually
5. **Monitor edge function** - webhook delivery is critical
6. **Keep calm** - rollback is quick and safe

---

## ✨ You're Ready!

This checklist has everything you need. Good luck with the migration! 🚀
