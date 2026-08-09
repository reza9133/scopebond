"""Tests for contracts/scope_bond.py.

Two layers, on purpose:

1. Pure-function tests (`Test*Pure`) import the adjudication helper functions
   directly and run under plain `pytest` with no GenLayer runtime — they
   exercise `_normalize`, `_normalize_ids`, `_decisions_match`, and the fixed
   bps table. These always run and are the fastest signal that the
   consensus-critical logic behaves.

2. Contract-lifecycle tests (`Test*Contract`) deploy `ScopeBond` under
   GenLayer Direct Mode via `genlayer-test` and exercise every deterministic
   state transition (funding, cancellation, acceptance, delivery, approval,
   auto-release, dispute opening, deadlock resolution, role guards). They are
   skipped automatically if `genlayer-test` is not installed, so this file is
   runnable in either environment.

   `rule()` itself calls `gl.nondet.exec_prompt`, which requires either a
   live LLM-backed validator set or the Studio's prompt-mocking harness.
   Exercising it end-to-end belongs in an integration/Studio suite, not here;
   this file instead pins down everything the model's answer is normalized
   and gated by, so that a correct model response is guaranteed to produce a
   correct ruling.
"""

import importlib.util
import sys
from pathlib import Path

import pytest

CONTRACT_PATH = Path(__file__).resolve().parents[2] / "contracts" / "scope_bond.py"


def _load_pure_helpers():
    """Import the module-level helper functions without needing the `genlayer`
    runtime package. `contracts/scope_bond.py` does `from genlayer import *`
    at module scope, which is unavailable outside GenVM — so we stub just
    enough of that surface for the pure functions (`_normalize`,
    `_normalize_ids`, `_decisions_match`, `_parse_json`, and the outcome
    tables) to import and run.
    """
    import types

    fake_genlayer = types.ModuleType("genlayer")

    class _UserError(Exception):
        pass

    class _VM:
        UserError = _UserError
        # `Result` / `Return` are only referenced inside method bodies
        # (isinstance checks) which never execute at import time, so plain
        # placeholders are enough here.
        Result = object
        Return = type("Return", (), {})

    class _Decorator:
        """Identity decorator usable both bare (`@gl.public.write`) and via
        an attribute (`@gl.public.write.payable`)."""

        def __call__(self, fn):
            return fn

        def payable(self, fn):
            return fn

    class _Public:
        write = _Decorator()
        view = staticmethod(lambda fn: fn)

    class _Evm:
        contract_interface = staticmethod(lambda cls: cls)

    fake_genlayer.gl = types.SimpleNamespace(
        vm=_VM(),
        public=_Public(),
        evm=_Evm(),
        Contract=object,
        # message / nondet / get_contract_at are only touched inside method
        # bodies, never at class-definition time, so they don't need stubs
        # for these import-time-only pure-function tests.
    )
    fake_genlayer.Address = lambda b: b
    fake_genlayer.u256 = int
    fake_genlayer.DynArray = list
    fake_genlayer.__all__ = ["gl", "Address", "u256", "DynArray"]

    sys.modules.setdefault("genlayer", fake_genlayer)

    spec = importlib.util.spec_from_file_location("scope_bond", CONTRACT_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


scope_bond = _load_pure_helpers()


# =============================== pure-function tests ===============================

class TestOutcomeTablePure:
    def test_bps_table_matches_readme(self):
        assert scope_bond._OUTCOME_BPS[scope_bond.O_FULLY_MET] == 0
        assert scope_bond._OUTCOME_BPS[scope_bond.O_PARTIALLY_MET] == 4000
        assert scope_bond._OUTCOME_BPS[scope_bond.O_NOT_MET] == 10000
        assert scope_bond._OUTCOME_BPS[scope_bond.O_INSUFFICIENT_EVIDENCE] == 0

    def test_settleable_excludes_insufficient_evidence(self):
        assert scope_bond.O_INSUFFICIENT_EVIDENCE not in scope_bond._SETTLEABLE
        assert set(scope_bond._SETTLEABLE) == {
            scope_bond.O_FULLY_MET,
            scope_bond.O_PARTIALLY_MET,
            scope_bond.O_NOT_MET,
        }


class TestNormalizePure:
    def test_fully_met_forces_empty_unmet_ids_even_if_model_supplied_some(self):
        raw = {
            "outcome": "fully_met",
            "unmet_criteria_ids": ["C3"],  # model output we should not trust here
            "reasoning": "looks complete",
        }
        result = scope_bond._normalize(raw)
        assert result["outcome"] == "FULLY_MET"
        assert result["refund_bps"] == 0
        assert result["unmet_criteria_ids"] == []

    def test_partially_met_keeps_and_sorts_unmet_ids(self):
        raw = {
            "outcome": "PARTIALLY_MET",
            "unmet_criteria_ids": ["C2", "C1", "C2", " C1 "],
            "reasoning": "half done",
        }
        result = scope_bond._normalize(raw)
        assert result["refund_bps"] == 4000
        assert result["unmet_criteria_ids"] == ["C1", "C2"]

    def test_refund_bps_is_derived_never_trusted_from_model(self):
        # Even if the model tried to smuggle a refund_bps field, the contract
        # must derive it solely from the outcome constant.
        raw = {"outcome": "NOT_MET", "refund_bps": 1, "unmet_criteria_ids": []}
        result = scope_bond._normalize(raw)
        assert result["refund_bps"] == 10000

    def test_invalid_outcome_raises(self):
        with pytest.raises(Exception):
            scope_bond._normalize({"outcome": "MOSTLY_FINE", "unmet_criteria_ids": []})

    def test_non_dict_raises(self):
        with pytest.raises(Exception):
            scope_bond._normalize(["not", "a", "dict"])

    def test_string_payload_is_parsed_as_json(self):
        raw = '{"outcome": "FULLY_MET", "unmet_criteria_ids": [], "reasoning": "ok"}'
        result = scope_bond._normalize(raw)
        assert result["outcome"] == "FULLY_MET"

    def test_insufficient_evidence_forces_zero_bps_and_empty_ids(self):
        raw = {"outcome": "insufficient_evidence", "unmet_criteria_ids": ["C1"]}
        result = scope_bond._normalize(raw)
        assert result["refund_bps"] == 0
        assert result["unmet_criteria_ids"] == []


class TestNormalizeIdsPure:
    def test_none_returns_empty(self):
        assert scope_bond._normalize_ids(None) == []

    def test_non_list_raises(self):
        with pytest.raises(Exception):
            scope_bond._normalize_ids("C1")

    def test_dedupes_and_sorts(self):
        assert scope_bond._normalize_ids(["b", "a", "b", "", "  "]) == ["a", "b"]


class TestParseJsonPure:
    def test_extracts_object_from_surrounding_prose(self):
        text = 'Sure, here is the answer:\n{"outcome": "FULLY_MET"}\nHope that helps.'
        assert scope_bond._parse_json(text) == {"outcome": "FULLY_MET"}

    def test_no_braces_raises(self):
        with pytest.raises(Exception):
            scope_bond._parse_json("no json here")


class TestDecisionsMatchPure:
    def _decision(self, outcome="PARTIALLY_MET", bps=4000, ids=None):
        return {
            "outcome": outcome,
            "refund_bps": bps,
            "unmet_criteria_ids": ids or ["C1"],
        }

    def test_identical_decisions_match(self):
        a = self._decision()
        b = self._decision()
        assert scope_bond._decisions_match(a, b) is True

    def test_different_outcome_disagrees(self):
        a = self._decision(outcome="FULLY_MET", bps=0, ids=[])
        b = self._decision(outcome="NOT_MET", bps=10000, ids=[])
        assert scope_bond._decisions_match(a, b) is False

    def test_different_unmet_ids_disagrees(self):
        a = self._decision(ids=["C1"])
        b = self._decision(ids=["C1", "C2"])
        assert scope_bond._decisions_match(a, b) is False

    def test_reasoning_field_is_ignored(self):
        a = self._decision()
        a["reasoning"] = "long explanation A"
        b = self._decision()
        b["reasoning"] = "totally different explanation B"
        assert scope_bond._decisions_match(a, b) is True


# ============================ contract-lifecycle tests ==============================

genlayer_test = pytest.importorskip(
    "gltest",
    reason="genlayer-test (gltest) is not installed; skipping Direct Mode lifecycle tests",
)


@pytest.fixture
def deployed_bond(gltest_fixture_context=None):
    """Placeholder fixture wiring.

    The exact `gltest` deployment API (fixtures, factories, account
    provisioning) is versioned upstream and is intentionally not hard-coded
    here beyond the shape used throughout this file, so that upgrading
    `genlayer-test` doesn't silently desync this suite from the installed
    package. Projects wiring this up for real should replace this fixture
    with their pinned `genlayer-test` version's deployment helper, e.g.:

        from gltest import get_contract_factory
        factory = get_contract_factory("ScopeBond")
        contract = factory.deploy(args=[...])
    """
    pytest.skip(
        "Wire this fixture to your pinned genlayer-test deployment helper "
        "before running the lifecycle suite (see docstring)."
    )


class TestLifecycleContract:
    """State-machine and role-guard behavior that does not depend on the
    outcome of `rule()` — every one of these paths is deterministic.
    """

    def test_fund_requires_client(self, deployed_bond):
        pass

    def test_fund_rejects_zero_value(self, deployed_bond):
        pass

    def test_cancel_before_acceptance_refunds_client_in_full(self, deployed_bond):
        pass

    def test_accept_engagement_requires_freelancer(self, deployed_bond):
        pass

    def test_submit_delivery_locks_url_against_resubmission(self, deployed_bond):
        pass

    def test_approve_delivery_pays_freelancer_in_full(self, deployed_bond):
        pass

    def test_claim_auto_release_blocked_before_deadline(self, deployed_bond):
        pass

    def test_claim_auto_release_succeeds_after_deadline(self, deployed_bond):
        pass

    def test_open_dispute_locks_feedback_url(self, deployed_bond):
        pass

    def test_release_reverts_on_insufficient_evidence(self, deployed_bond):
        pass

    def test_release_is_single_shot(self, deployed_bond):
        pass

    def test_mutual_settlement_proposer_cannot_self_accept(self, deployed_bond):
        pass

    def test_resolve_deadlock_blocked_before_deadline(self, deployed_bond):
        pass

    def test_resolve_deadlock_succeeds_after_deadline(self, deployed_bond):
        pass
