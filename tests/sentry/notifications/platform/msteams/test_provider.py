from sentry.notifications.platform.msteams.provider import MSTeamsNotificationProvider
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.notifications.platform import MockNotification, MockNotificationTemplate


class MSTeamsRendererTest(TestCase):
    def test_default_renderer(self) -> None:
        data = MockNotification(message="test")
        template = MockNotificationTemplate()
        rendered_template = template.render(data)
        renderer = MSTeamsNotificationProvider.get_renderer(
            data=data, category=NotificationCategory.DEBUG
        )
        assert renderer.render(data=data, rendered_template=rendered_template) == {}


class MSTeamsNotificationProviderTest(TestCase):
    def test_basic_fields(self) -> None:
        provider = MSTeamsNotificationProvider()
        assert provider.key == NotificationProviderKey.MSTEAMS
        assert provider.target_class == IntegrationNotificationTarget
        assert provider.target_resource_types == [
            NotificationTargetResourceType.CHANNEL,
            NotificationTargetResourceType.DIRECT_MESSAGE,
        ]

    def test_is_available(self) -> None:
        assert MSTeamsNotificationProvider.is_available() is False
        assert MSTeamsNotificationProvider.is_available(organization=self.organization) is False
