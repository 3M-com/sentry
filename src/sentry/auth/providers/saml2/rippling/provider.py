from django.http.request import HttpRequest
from django.http.response import HttpResponseBase

from sentry.auth.providers.saml2.forms import URLMetadataForm
from sentry.auth.providers.saml2.provider import Attributes, SAML2Provider
from sentry.auth.providers.saml2.views import make_simple_setup
from sentry.auth.view import AuthView

SelectIdP = make_simple_setup(URLMetadataForm, "sentry_auth_rippling/select-idp.html")


class WaitForCompletion(AuthView):
    """
    Rippling provides the Metadata URL during initial application setup, before
    configuration values have been saved, thus we cannot immediately attempt to
    create an identity for the setting up the SSO.

    This is simply an extra step to wait for them to complete that.
    """

    def handle(self, request: HttpRequest, pipeline) -> HttpResponseBase:
        if "continue_setup" in request.POST:
            return pipeline.next_step()

        return self.respond("sentry_auth_rippling/wait-for-completion.html")


class RipplingSAML2Provider(SAML2Provider):
    name = "Rippling"
    key = "rippling"

    def get_saml_setup_pipeline(self) -> list[AuthView]:
        return [SelectIdP(), WaitForCompletion()]

    def attribute_mapping(self) -> dict[str, str]:
        return {
            Attributes.IDENTIFIER: "user_id",
            Attributes.USER_EMAIL: "urn:oid:1.2.840.113549.1.9.1.1",
            Attributes.FIRST_NAME: "first_name",
            Attributes.LAST_NAME: "last_name",
        }
