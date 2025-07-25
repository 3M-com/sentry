from __future__ import annotations

from unittest import TestCase

from sentry.api.base import Endpoint
from sentry.ratelimits import get_rate_limit_config, get_rate_limit_value
from sentry.ratelimits.config import RateLimitConfig, get_default_rate_limits_for_group
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class TestGetRateLimitValue(TestCase):
    def test_default_rate_limit_values(self) -> None:
        """Ensure that the default rate limits are called for endpoints without overrides."""

        class TestEndpoint(Endpoint):
            pass

        _test_endpoint = TestEndpoint.as_view()
        rate_limit_config = get_rate_limit_config(_test_endpoint.view_class)

        assert get_rate_limit_value(
            "GET", RateLimitCategory.IP, rate_limit_config
        ) == get_default_rate_limits_for_group("default", RateLimitCategory.IP)
        assert get_rate_limit_value(
            "POST", RateLimitCategory.ORGANIZATION, rate_limit_config
        ) == get_default_rate_limits_for_group("default", RateLimitCategory.ORGANIZATION)
        assert get_rate_limit_value(
            "DELETE", RateLimitCategory.USER, rate_limit_config
        ) == get_default_rate_limits_for_group("default", RateLimitCategory.USER)

    def test_cli_group_rate_limit_values(self) -> None:
        """Ensure that the CLI Group has the correct rate limit defaults set"""

        class TestEndpoint(Endpoint):
            rate_limits = RateLimitConfig(group="CLI")

        _test_endpoint = TestEndpoint.as_view()
        rate_limit_config = get_rate_limit_config(_test_endpoint.view_class)

        assert get_rate_limit_value(
            "GET", RateLimitCategory.IP, rate_limit_config
        ) == get_default_rate_limits_for_group("CLI", RateLimitCategory.IP)
        assert get_rate_limit_value(
            "POST", RateLimitCategory.ORGANIZATION, rate_limit_config
        ) == get_default_rate_limits_for_group("CLI", RateLimitCategory.ORGANIZATION)
        assert get_rate_limit_value(
            "DELETE", RateLimitCategory.USER, rate_limit_config
        ) == get_default_rate_limits_for_group("CLI", RateLimitCategory.USER)

    def test_override_rate_limit(self) -> None:
        """Override one or more of the default rate limits."""

        class TestEndpoint(Endpoint):
            rate_limits = {
                "GET": {RateLimitCategory.IP: RateLimit(limit=100, window=5)},
                "POST": {RateLimitCategory.USER: RateLimit(limit=20, window=4)},
            }

        _test_endpoint = TestEndpoint.as_view()
        rate_limit_config = get_rate_limit_config(_test_endpoint.view_class)

        assert get_rate_limit_value("GET", RateLimitCategory.IP, rate_limit_config) == RateLimit(
            100, 5
        )
        assert get_rate_limit_value(
            "GET", RateLimitCategory.USER, rate_limit_config
        ) == get_default_rate_limits_for_group("default", RateLimitCategory.USER)
        assert get_rate_limit_value(
            "POST", RateLimitCategory.IP, rate_limit_config
        ) == get_default_rate_limits_for_group("default", RateLimitCategory.IP)
        assert get_rate_limit_value("POST", RateLimitCategory.USER, rate_limit_config) == RateLimit(
            20, 4
        )

    def test_inherit(self) -> None:
        class ParentEndpoint(Endpoint):
            rate_limits = RateLimitConfig(
                group="foo",
                limit_overrides={"GET": {RateLimitCategory.IP: RateLimit(limit=100, window=5)}},
            )

        class ChildEndpoint(ParentEndpoint):
            rate_limits = RateLimitConfig(group="foo", limit_overrides={"GET": {}})

        _child_endpoint = ChildEndpoint.as_view()
        rate_limit_config = get_rate_limit_config(_child_endpoint.view_class)

        assert get_rate_limit_value(
            "GET", RateLimitCategory.IP, rate_limit_config
        ) == get_default_rate_limits_for_group("foo", RateLimitCategory.IP)
