import { Link } from '@tanstack/react-router'

export function ExperienceShell({
  children,
  stageClassName,
}: {
  children: React.ReactNode
  stageClassName: string
}) {
  return (
    <main className={`experience-shell ${stageClassName}`}>
      <section className="experience-topbar">
        <Link className="experience-brand" to="/">
          <span className="experience-brand-mark" aria-hidden="true" />
          <span>游戏王启动率计算器</span>
        </Link>
      </section>

      <section className="experience-frame">{children}</section>
    </main>
  )
}
