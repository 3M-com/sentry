from django.db import IntegrityError, transaction
from django.db.models import F
from django.db.models.signals import post_save
from django.utils import timezone

from sentry import analytics
from sentry.models import (
    Activity,
    Commit,
    Group,
    GroupAssignee,
    GroupInboxRemoveAction,
    GroupLink,
    GroupStatus,
    GroupSubscription,
    Project,
    PullRequest,
    Release,
    ReleaseProject,
    Repository,
    UserOption,
    remove_group_from_inbox,
)
from sentry.models.grouphistory import (
    GroupHistoryStatus,
    record_group_history,
    record_group_history_from_activity_type,
)
from sentry.notifications.types import GroupSubscriptionReason
from sentry.signals import buffer_incr_complete, issue_resolved
from sentry.tasks.clear_expired_resolutions import clear_expired_resolutions


def resolve_group_resolutions(instance, created, **kwargs):
    if not created:
        return

    clear_expired_resolutions.delay(release_id=instance.id)


def remove_resolved_link(link):
    # TODO(dcramer): ideally this would simply "undo" the link change,
    # but we don't know for a fact that the resolution was most recently from
    # the GroupLink
    with transaction.atomic():
        link.delete()
        affected = Group.objects.filter(status=GroupStatus.RESOLVED, id=link.group_id).update(
            status=GroupStatus.UNRESOLVED
        )
        if affected:
            Activity.objects.create(
                project_id=link.project_id,
                group_id=link.group_id,
                type=Activity.SET_UNRESOLVED,
                ident=link.group_id,
            )
            record_group_history_from_activity_type(
                Group.objects.get(id=link.group_id), Activity.SET_UNRESOLVED
            )


def resolved_in_commit(instance, created, **kwargs):
    current_datetime = timezone.now()

    groups = instance.find_referenced_groups()

    # Delete GroupLinks where message may have changed
    group_ids = {g.id for g in groups}
    group_links = GroupLink.objects.filter(
        linked_type=GroupLink.LinkedType.commit,
        relationship=GroupLink.Relationship.resolves,
        linked_id=instance.id,
    )
    for link in group_links:
        if link.group_id not in group_ids:
            remove_resolved_link(link)

    try:
        repo = Repository.objects.get(id=instance.repository_id)
    except Repository.DoesNotExist:
        repo = None

    for group in groups:
        try:
            # XXX(dcramer): This code is somewhat duplicated from the
            # project_group_index mutation api
            with transaction.atomic():
                GroupLink.objects.create(
                    group_id=group.id,
                    project_id=group.project_id,
                    linked_type=GroupLink.LinkedType.commit,
                    relationship=GroupLink.Relationship.resolves,
                    linked_id=instance.id,
                )

                if instance.author:
                    user_list = list(instance.author.find_users())
                else:
                    user_list = ()

                acting_user = None

                if user_list:
                    acting_user = user_list[0]
                    self_assign_issue = UserOption.objects.get_value(
                        user=acting_user, key="self_assign_issue", default="0"
                    )
                    if self_assign_issue == "1" and not group.assignee_set.exists():
                        GroupAssignee.objects.assign(
                            group=group, assigned_to=acting_user, acting_user=acting_user
                        )

                    # while we only create activity and assignment for one user we want to
                    # subscribe every user
                    for user in user_list:
                        GroupSubscription.objects.subscribe(
                            user=user, group=group, reason=GroupSubscriptionReason.status_change
                        )

                Activity.objects.create(
                    project_id=group.project_id,
                    group=group,
                    type=Activity.SET_RESOLVED_IN_COMMIT,
                    ident=instance.id,
                    user=acting_user,
                    data={"commit": instance.id},
                )
                Group.objects.filter(id=group.id).update(
                    status=GroupStatus.RESOLVED, resolved_at=current_datetime
                )
                remove_group_from_inbox(group, action=GroupInboxRemoveAction.RESOLVED)
                record_group_history_from_activity_type(
                    group,
                    Activity.SET_RESOLVED_IN_COMMIT,
                    actor=acting_user if acting_user else None,
                )

        except IntegrityError:
            pass
        else:
            if repo is not None:
                if repo.integration_id is not None:
                    analytics.record(
                        "integration.resolve.commit",
                        provider=repo.provider,
                        id=repo.integration_id,
                        organization_id=repo.organization_id,
                    )
                user = user_list[0] if user_list else None

                issue_resolved.send_robust(
                    organization_id=repo.organization_id,
                    user=user,
                    group=group,
                    project=group.project,
                    resolution_type="with_commit",
                    sender="resolved_with_commit",
                )


def resolved_in_pull_request(instance, created, **kwargs):
    groups = instance.find_referenced_groups()

    # Delete GroupLinks where message may have changed
    group_ids = {g.id for g in groups}
    group_links = GroupLink.objects.filter(
        linked_type=GroupLink.LinkedType.pull_request,
        relationship=GroupLink.Relationship.resolves,
        linked_id=instance.id,
    )
    for link in group_links:
        if link.group_id not in group_ids:
            remove_resolved_link(link)

    try:
        repo = Repository.objects.get(id=instance.repository_id)
    except Repository.DoesNotExist:
        repo = None

    for group in groups:
        try:
            with transaction.atomic():
                GroupLink.objects.create(
                    group_id=group.id,
                    project_id=group.project_id,
                    linked_type=GroupLink.LinkedType.pull_request,
                    relationship=GroupLink.Relationship.resolves,
                    linked_id=instance.id,
                )

                if instance.author:
                    user_list = list(instance.author.find_users())
                else:
                    user_list = ()
                acting_user = None
                if user_list:
                    acting_user = user_list[0]
                    GroupAssignee.objects.assign(
                        group=group, assigned_to=acting_user, acting_user=acting_user
                    )

                Activity.objects.create(
                    project_id=group.project_id,
                    group=group,
                    type=Activity.SET_RESOLVED_IN_PULL_REQUEST,
                    ident=instance.id,
                    user=acting_user,
                    data={"pull_request": instance.id},
                )
                record_group_history(
                    group, GroupHistoryStatus.SET_RESOLVED_IN_PULL_REQUEST, actor=acting_user
                )
        except IntegrityError:
            pass
        else:
            if repo is not None and repo.integration_id is not None:
                analytics.record(
                    "integration.resolve.pr",
                    provider=repo.provider,
                    id=repo.integration_id,
                    organization_id=repo.organization_id,
                )


post_save.connect(
    resolve_group_resolutions, sender=Release, dispatch_uid="resolve_group_resolutions", weak=False
)

post_save.connect(resolved_in_commit, sender=Commit, dispatch_uid="resolved_in_commit", weak=False)

post_save.connect(
    resolved_in_pull_request,
    sender=PullRequest,
    dispatch_uid="resolved_in_pull_request",
    weak=False,
)


@buffer_incr_complete.connect(
    sender=ReleaseProject, dispatch_uid="project_has_releases_receiver", weak=False
)
def project_has_releases_receiver(filters, **_):
    try:
        project = ReleaseProject.objects.select_related("project").get(**filters).project
    except ReleaseProject.DoesNotExist:
        return

    if not project.flags.has_releases:
        project.flags.has_releases = True
        project.update(flags=F("flags").bitor(Project.flags.has_releases))
