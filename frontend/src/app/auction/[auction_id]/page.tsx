import { ErrorBanner } from '@/components/ui/banner'
import { AuctionDetail } from '@/components/auction/auction-detail'

export default async function AuctionDetailsPage (props: { params: Promise<{ auction_id?: string }> }) {
	const { auction_id: auctionId } = await props.params

	if (!auctionId) {
		return (
			<ErrorBanner title='Missing auction id'>
				This route requires an <code className='font-mono'>auction_id</code> param.
			</ErrorBanner>
		)
	}

	return <AuctionDetail auctionId={auctionId} />
}


