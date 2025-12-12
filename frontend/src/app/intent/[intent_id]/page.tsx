import { ErrorBanner } from '@/components/ui/banner'
import { IntentDetail } from '@/components/intent/intent-detail'

export default async function IntentDetailsPage (props: { params: Promise<{ intent_id?: string }> }) {
	const { intent_id: intentId } = await props.params

	if (!intentId) {
		return (
			<ErrorBanner title='Missing intent id'>
				This route requires an <code className='font-mono'>intent_id</code> param.
			</ErrorBanner>
		)
	}

	return <IntentDetail intentId={intentId} />
}


