import { ErrorBanner } from '@/components/ui/banner'

export default async function AuctionDetailsPage (props: { params: Promise<{ auction_id?: string }> }) {
	const { auction_id: auctionId } = await props.params

	if (!auctionId) {
		return (
			<ErrorBanner title='Missing auction id'>
				This route requires an <code className='font-mono'>auction_id</code> param.
			</ErrorBanner>
		)
	}

	return (
		<div className='space-y-2'>
			<h1 className='text-xl font-semibold tracking-tight'>Auction</h1>
			<p className='text-sm text-zinc-700'>
				Placeholder page for <code className='font-mono'>{auctionId}</code>.
			</p>
		</div>
	)
}


