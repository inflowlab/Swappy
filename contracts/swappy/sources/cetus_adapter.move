module swappy::cetus_adapter;

use sui::coin::Coin;
use sui::object::ID;

/// === Error codes ===
const ECetusNotIntegrated: u64 = 900;

/// Adapter boundary for Cetus exact-in swaps (SUI/USDC).
///
/// This module is intentionally a thin wrapper so the core protocol does not
/// "invent" swap semantics: we need the exact Cetus package address/module/function signature.
///
/// Until those details are provided, settlement paths that require Cetus will abort.
public fun swap_exact_in_sui_usdc(
    _pool_id: ID,
    _coin_in: Coin<sui::sui::SUI>,
    _amount_in: u64,
    _min_amount_out: u64,
    _ctx: &mut sui::tx_context::TxContext,
): Coin<swappy::usdc_coin::USDC> {
    abort ECetusNotIntegrated
}

public fun swap_exact_in_usdc_sui(
    _pool_id: ID,
    _coin_in: Coin<swappy::usdc_coin::USDC>,
    _amount_in: u64,
    _min_amount_out: u64,
    _ctx: &mut sui::tx_context::TxContext,
): Coin<sui::sui::SUI> {
    abort ECetusNotIntegrated
}


