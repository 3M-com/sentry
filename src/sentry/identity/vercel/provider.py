from sentry import options
from sentry.identity.oauth2 import OAuth2CallbackView, OAuth2Provider
from sentry.identity.pipeline import IdentityPipeline
from sentry.pipeline.views.base import PipelineView


class VercelIdentityProvider(OAuth2Provider):
    key = "vercel"
    name = "Vercel"

    # https://vercel.com/docs/integrations/reference#using-the-vercel-api/exchange-code-for-access-token
    oauth_access_token_url = "https://api.vercel.com/v2/oauth/access_token"

    def get_oauth_client_id(self):
        return options.get("vercel.client-id")

    def get_oauth_client_secret(self):
        return options.get("vercel.client-secret")

    def get_refresh_token_url(self) -> str:
        return self.oauth_access_token_url

    def get_pipeline_views(self) -> list[PipelineView[IdentityPipeline]]:
        return [
            OAuth2CallbackView(
                access_token_url=self.oauth_access_token_url,
                client_id=self.get_oauth_client_id(),
                client_secret=self.get_oauth_client_secret(),
            ),
        ]
