from unittest import mock

import responses
from django.db import router, transaction
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse
from rest_framework import status

from fixtures.gitlab import EXTERNAL_ID, PUSH_EVENT, WEBHOOK_SECRET, WEBHOOK_TOKEN
from sentry.hybridcloud.models.outbox import outbox_context
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.middleware.integrations.classifications import IntegrationClassification
from sentry.middleware.integrations.parsers.gitlab import GitlabRequestParser
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import assert_no_webhook_payloads, assert_webhook_payloads_for_mailbox
from sentry.testutils.region import override_regions
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory

region = Region("us", 1, "https://us.testserver", RegionCategory.MULTI_TENANT)
region_config = (region,)


@control_silo_test
class GitlabRequestParserTest(TestCase):
    factory = RequestFactory()
    path = f"{IntegrationClassification.integration_prefix}gitlab/webhook/"

    def get_response(self, req: HttpRequest) -> HttpResponse:
        return HttpResponse(status=200, content="passthrough")

    def get_integration(self) -> Integration:
        self.organization = self.create_organization(owner=self.user, region="us")
        return self.create_integration(
            organization=self.organization,
            provider="gitlab",
            name="Example Gitlab",
            external_id=EXTERNAL_ID,
            metadata={
                "instance": "example.gitlab.com",
                "base_url": "https://example.gitlab.com",
                "domain_name": "example.gitlab.com/group-x",
                "verify_ssl": False,
                "webhook_secret": WEBHOOK_SECRET,
                "group_id": 1,
            },
        )

    def run_parser(self, request):
        parser = GitlabRequestParser(request=request, response_handler=self.get_response)
        return parser.get_response()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    def test_missing_x_gitlab_token(self) -> None:
        self.get_integration()
        request = self.factory.post(
            self.path,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_EVENT="lol",
        )
        response = self.run_parser(request)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert (
            response.reason_phrase == "The customer needs to set a Secret Token in their webhook."
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    def test_invalid_token(self) -> None:
        self.get_integration()
        request = self.factory.post(
            self.path,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN="wrong",
            HTTP_X_GITLAB_EVENT="Push Hook",
        )
        response = self.run_parser(request)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.reason_phrase == "The customer's Secret Token is malformed."
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    @responses.activate
    def test_routing_webhook_properly_no_regions(self) -> None:
        request = self.factory.post(
            self.path,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Push Hook",
        )

        integration = self.get_integration()
        with outbox_context(transaction.atomic(using=router.db_for_write(OrganizationIntegration))):
            # Remove all organizations from integration
            OrganizationIntegration.objects.filter(integration=integration).delete()

        parser = GitlabRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    @responses.activate
    def test_routing_webhook_properly_with_regions(self) -> None:
        integration = self.get_integration()
        request = self.factory.post(
            self.path,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Push Hook",
        )
        parser = GitlabRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.content == b""
        assert len(responses.calls) == 0
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"gitlab:{integration.id}",
            region_names=[region.name],
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    @responses.activate
    def test_routing_webhook_properly_with_multiple_orgs(self) -> None:
        integration = self.get_integration()
        other_org = self.create_organization(owner=self.user)
        integration.add_organization(other_org)

        request = self.factory.post(
            self.path,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Push Hook",
        )
        parser = GitlabRequestParser(request=request, response_handler=self.get_response)
        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == 202
        assert response.content == b""
        assert len(responses.calls) == 0
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"gitlab:{integration.id}",
            region_names=[region.name],
        )

    @override_regions(region_config)
    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @responses.activate
    def test_routing_webhook_with_mailbox_buckets(self) -> None:
        integration = self.get_integration()
        request = self.factory.post(
            self.path,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Push Hook",
        )
        with mock.patch(
            "sentry.integrations.middleware.hybrid_cloud.parser.ratelimiter.is_limited"
        ) as mock_is_limited:
            mock_is_limited.return_value = True
            parser = GitlabRequestParser(request=request, response_handler=self.get_response)
            response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.content == b""
        assert len(responses.calls) == 0
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"gitlab:{integration.id}:15",
            region_names=[region.name],
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    @responses.activate
    def test_routing_search_properly(self) -> None:
        self.get_integration()
        path = reverse(
            "sentry-extensions-gitlab-search",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "integration_id": self.integration.id,
            },
        )
        request = self.factory.post(path, data={}, content_type="application/json")
        parser = GitlabRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()
        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_200_OK
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    def test_get_integration_from_request(self) -> None:
        integration = self.get_integration()
        request = self.factory.post(
            self.path,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Push Hook",
        )
        parser = GitlabRequestParser(request=request, response_handler=self.get_response)
        result = parser.get_integration_from_request()
        assert result is not None
        assert result.id == integration.id

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_regions(region_config)
    @responses.activate
    def test_webhook_outbox_creation(self) -> None:
        request = self.factory.post(
            self.path,
            data=PUSH_EVENT,
            content_type="application/json",
            HTTP_X_GITLAB_TOKEN=WEBHOOK_TOKEN,
            HTTP_X_GITLAB_EVENT="Push Hook",
        )
        integration = self.get_integration()
        parser = GitlabRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()

        assert isinstance(response, HttpResponse)
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.content == b""
        assert len(responses.calls) == 0
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"gitlab:{integration.id}",
            region_names=[region.name],
        )
