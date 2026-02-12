import HostDialogue from './HostDialogue'

export default function MorningReveal({ murdered, onContinue }) {
  if (!murdered) return null

  return (
    <div className="morning-reveal">
      <HostDialogue
        text={`This morning at breakfast, ${murdered.name}'s chair sits empty.`}
        onContinue={onContinue}
        showContinue={true}
      />
    </div>
  )
}
