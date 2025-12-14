'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { parseFreeTextIntent } from '@/lib/api'
import type { FreeTextIntentParseResponse } from '@/lib/api'
import { useWalletConnection } from '@/components/wallet/wallet-connection'
import { ErrorBanner, WarningBanner } from '@/components/ui/banner'
import { InlineNotification } from '@/components/ui/notification'
import { useTokenRegistry } from '@/components/tokens/token-registry'
import { useNetworkHealth } from '@/components/network/network-health'
import { useNetwork } from '@/components/network/network-provider'
import { createIntentAndDeposit } from '@/lib/wallet'
import { getTxExplorerUrl } from '@/lib/explorer'
import { logUiError, toUiError } from '@/lib/errors/ui-errors'
import { env } from '@/lib/env'
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit'

function formatUtc (ms: number) {
	try {
		return new Date(ms).toUTCString()
	} catch {
		return String(ms)
	}
}

export default function NewIntentPage () {
	const router = useRouter()
	const { connected, address, connect } = useWalletConnection()
	const tokenRegistry = useTokenRegistry()
	const networkHealth = useNetworkHealth()
	const { network } = useNetwork()
	const client = useSuiClient()

	const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction({
		execute: async ({ bytes, signature }) =>
			await client.executeTransactionBlock({
				transactionBlock: bytes,
				signature,
				options: {
					showRawEffects: true,
					showObjectChanges: true,
				},
			}),
	})

	const [text, setText] = useState('')
	const [isParsing, setIsParsing] = useState(false)
	const [parseError, setParseError] = useState<string | null>(null)
	const [parsed, setParsed] = useState<FreeTextIntentParseResponse | null>(null)

	const [isSubmitting, setIsSubmitting] = useState(false)
	const [txDigest, setTxDigest] = useState<string | null>(null)
	const [intentId, setIntentId] = useState<string | null>(null)
	const [txError, setTxError] = useState<string | null>(null)
	const [notification, setNotification] = useState<string | null>(null)

	const hasWallet = connected && Boolean(address)
	const canInteract = hasWallet && !isSubmitting && (!networkHealth.error || env.useMockChain)
	const canConfirm = canInteract && !isSubmitting && !Boolean(networkHealth.error)

	const isTextValid = text.trim().length > 0

	const makeIdempotencyKey = () => {
		// Browser-only; safe fallback for older environments.
		try {
			return crypto.randomUUID()
		} catch {
			return `idem_${Date.now()}_${Math.random().toString(16).slice(2)}`
		}
	}

	const sellToken = useMemo(() => {
		if (!parsed) return null
		return tokenRegistry.getById(parsed.parsed.sellToken) ?? null
	}, [parsed, tokenRegistry])

	const buyToken = useMemo(() => {
		if (!parsed) return null
		return tokenRegistry.getById(parsed.parsed.buyToken) ?? null
	}, [parsed, tokenRegistry])

	const txExplorerUrl = txDigest ? getTxExplorerUrl(txDigest) : null

	return (
		<div className='space-y-6'>
			<div className='flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
				<div className='space-y-1'>
					<h1 className='text-2xl font-semibold tracking-tight'>Create Intent</h1>
					<p className='text-sm text-zinc-700'>
						Describe what you want to trade in natural language, preview the parsed intent, then
						explicitly approve on-chain escrow.
					</p>
				</div>
				<Link
					href='/'
					className='inline-flex h-9 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50'
				>
					Back to Dashboard
				</Link>
			</div>

			{!hasWallet ? (
				<WarningBanner title='Connect your wallet to create an intent'>
					All inputs are disabled until you connect.
					<div className='mt-3'>
						<button
							type='button'
							onClick={() => {
								setNotification(null)
								void connect().catch((err) => {
									const uiErr = toUiError(err, { area: 'connect' })
									logUiError(uiErr, { op: 'walletConnect' })
									setNotification(uiErr.userMessage)
								})
							}}
							className='inline-flex h-9 items-center rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800'
						>
							Connect Wallet
						</button>
					</div>
				</WarningBanner>
			) : null}

			{notification ? <InlineNotification tone='warning' message={notification} /> : null}

			<div className='space-y-2'>
				<label className='text-sm font-semibold' htmlFor='intent-text'>
					Intent description
				</label>
				<textarea
					id='intent-text'
					disabled={!canInteract || isParsing}
					value={text}
					onChange={(e) => {
						setText(e.target.value)
						setParseError(null)
						setTxError(null)
						setTxDigest(null)
						setIntentId(null)
						// Changing text invalidates preview; user must parse again.
						setParsed(null)
					}}
					rows={5}
					placeholder='Examples:\n- Swap 10 SUI to USDC, max 0.5% slippage, 15 minutes\n- Sell 200 USDC for SUI within 10 minutes'
					className='w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-400 disabled:bg-zinc-50'
				/>
				<div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
					<div className='text-xs text-zinc-500'>
						We do not parse on the client. Your raw text is sent to the backend when you click Parse.
					</div>
					<button
						type='button'
						disabled={!canInteract || isParsing || !isTextValid}
						onClick={() => {
							const idempotencyKey = makeIdempotencyKey()
							setIsParsing(true)
							setParseError(null)
							void parseFreeTextIntent({ text }, { idempotencyKey })
								.then((res) => {
									setParsed(res)
								})
								.catch((err) => {
									const uiErr = toUiError(err, { area: 'parse' })
									logUiError(uiErr, { op: 'parseFreeTextIntent' })
									setParseError(uiErr.userMessage)
								})
								.finally(() => setIsParsing(false))
						}}
						className='inline-flex h-9 items-center rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300'
					>
						{isParsing ? 'Parsing…' : 'Parse'}
					</button>
				</div>
			</div>

			{parseError ? <ErrorBanner title='Parse error'>{parseError}</ErrorBanner> : null}

			{parsed ? (
				<div className='space-y-3 rounded-lg border border-zinc-200 bg-white p-4'>
					<div className='flex items-center justify-between gap-3'>
						<div className='text-sm font-semibold'>Parsed intent preview</div>
						<div className='text-xs text-zinc-600'>Read-only. You must confirm explicitly to escrow.</div>
					</div>

					<WarningBanner title='Important: escrow warning'>
						Funds will be escrowed on-chain until settlement, cancellation, or expiration.
					</WarningBanner>

					<div className='grid gap-3 sm:grid-cols-2'>
						<div className='rounded-md border border-zinc-200 p-3'>
							<div className='text-xs font-semibold text-zinc-700'>Sell</div>
							<div className='mt-1 text-sm text-zinc-950'>
										{parsed.parsed.sellAmount}{' '}
										{tokenRegistry.formatLabel({
											symbol: sellToken?.symbol ?? null,
											tokenId: parsed.parsed.sellToken,
										})}
							</div>
						</div>
						<div className='rounded-md border border-zinc-200 p-3'>
							<div className='text-xs font-semibold text-zinc-700'>Buy (minimum)</div>
							<div className='mt-1 text-sm text-zinc-950'>
										{parsed.parsed.minBuyAmount}{' '}
										{tokenRegistry.formatLabel({
											symbol: buyToken?.symbol ?? null,
											tokenId: parsed.parsed.buyToken,
										})}
							</div>
						</div>
						<div className='rounded-md border border-zinc-200 p-3'>
							<div className='text-xs font-semibold text-zinc-700'>Pair</div>
							<div className='mt-1 text-sm text-zinc-950'>
										{tokenRegistry.formatLabel({
											symbol: sellToken?.symbol ?? null,
											tokenId: parsed.parsed.sellToken,
										})}{' '}
										→{' '}
										{tokenRegistry.formatLabel({
											symbol: buyToken?.symbol ?? null,
											tokenId: parsed.parsed.buyToken,
										})}
							</div>
						</div>
						<div className='rounded-md border border-zinc-200 p-3'>
							<div className='text-xs font-semibold text-zinc-700'>Expiration</div>
							<div className='mt-1 text-sm text-zinc-950'>{formatUtc(parsed.parsed.expiresAtMs)}</div>
						</div>
					</div>

							{sellToken?.indicativePriceUsd || buyToken?.indicativePriceUsd ? (
								<div className='rounded-md border border-zinc-200 p-3'>
									<div className='text-xs font-semibold text-zinc-700'>Indicative prices (preview only)</div>
									<div className='mt-1 text-sm text-zinc-950'>
										{sellToken?.symbol ? `${sellToken.symbol}: $${sellToken.indicativePriceUsd ?? '—'}` : null}
										{sellToken?.symbol && buyToken?.symbol ? ' · ' : null}
										{buyToken?.symbol ? `${buyToken.symbol}: $${buyToken.indicativePriceUsd ?? '—'}` : null}
									</div>
									<div className='mt-1 text-xs text-zinc-500'>
										Prices are indicative only. Final execution enforced on-chain.
									</div>
								</div>
							) : null}

					<div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
						<div className='text-xs text-zinc-500'>No signing happens until you click Confirm & Deposit.</div>
						<button
							type='button'
							disabled={!canConfirm}
							onClick={() => {
								setIsSubmitting(true)
								setTxError(null)
								setTxDigest(null)
								setIntentId(null)
								if (!address) {
									setTxError('Wallet not connected.')
									setIsSubmitting(false)
									return
								}
								if (!sellToken || !buyToken) {
									setTxError('Token metadata unavailable. Please refresh and try again.')
									setIsSubmitting(false)
									return
								}

								void createIntentAndDeposit({
									parsed: parsed.parsed,
									network,
									owner: address,
									sellDecimals: sellToken.decimals,
									buyDecimals: buyToken.decimals,
									client,
									signAndExecute: async (tx, chain) => {
										try {
											const res = await signAndExecuteTransaction({
												transaction: tx,
												chain: chain as `${string}:${string}`,
											})
											return { digest: res.digest, objectChanges: res.objectChanges }
										} catch (e) {
											const msg =
												e instanceof Error
													? e.message
													: e && typeof e === 'object'
														? (() => {
																try {
																	return JSON.stringify(e)
																} catch {
																	return ''
																}
															})()
														: String(e ?? '')
											throw new Error(`Wallet signAndExecuteTransaction failed. ${msg}`)
										}
									},
								})
									.then((res) => {
										setTxDigest(res.digest)
										setIntentId(res.intentId)
										// Redirect after showing the result briefly
										setTimeout(() => {
											router.push(`/intent/${encodeURIComponent(res.intentId)}`)
										}, 1000)
									})
									.catch((err) => {
										const uiErr = toUiError(err, { area: 'sign' })
										logUiError(uiErr, { op: 'createIntentAndDeposit' })
										setTxError(`${uiErr.userMessage} You can retry without re-parsing.`)
									})
									.finally(() => setIsSubmitting(false))
							}}
							className='inline-flex h-9 items-center rounded-md bg-emerald-700 px-3 text-sm font-medium text-white hover:bg-emerald-600 disabled:bg-zinc-300'
						>
							{isSubmitting ? 'Creating intent and escrowing funds…' : 'Confirm & Deposit'}
						</button>
					</div>

					{txError ? <ErrorBanner title='Transaction error'>{txError}</ErrorBanner> : null}

					{txDigest && intentId ? (
						<div className='rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950'>
							<div className='text-sm font-semibold'>Intent created</div>
							<div className='mt-2 space-y-1 text-sm'>
								<div>
									Intent ID: <code className='font-mono'>{intentId}</code>
								</div>
								<div>
									Tx digest: <code className='font-mono'>{txDigest}</code>
								</div>
								{txExplorerUrl ? (
									<div>
										<a
											href={txExplorerUrl}
											target='_blank'
											rel='noreferrer'
											className='underline'
										>
											View on Sui Explorer
										</a>
									</div>
								) : null}
							</div>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	)
}


