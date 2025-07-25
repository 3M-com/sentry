from typing import Any

from sentry.constants import LOG_LEVELS_MAP
from sentry.eventstore.models import GroupEvent
from sentry.rules import MatchType
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


@condition_handler_registry.register(Condition.LEVEL)
class LevelConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.EVENT_ATTRIBUTES

    comparison_json_schema = {
        "type": "object",
        "properties": {
            "level": {"type": "integer", "enum": list(LOG_LEVELS_MAP.values())},
            "match": {"type": "string", "enum": [*MatchType]},
        },
        "required": ["level", "match"],
        "additionalProperties": False,
    }

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        event = event_data.event

        if not isinstance(event, GroupEvent):
            # This condition is only applicable to GroupEvent
            return False

        level_name = event.get_tag("level")
        if level_name is None:
            return False

        desired_level = int(comparison.get("level"))
        desired_match = comparison.get("match")

        # Fetch the event level from the tags since event.level is
        # event.group.level which may have changed
        try:
            level: int = LOG_LEVELS_MAP[level_name]
        except KeyError:
            return False

        if desired_match == MatchType.EQUAL:
            return level == desired_level
        elif desired_match == MatchType.GREATER_OR_EQUAL:
            return level >= desired_level
        elif desired_match == MatchType.LESS_OR_EQUAL:
            return level <= desired_level
        return False
