export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="page-wrap site-footer-inner">
        <p>&copy; {year} Yu-Gi-Oh Tools</p>
        <p>
          Upload YDK files, resolve card data, and review the full deck on one
          screen.
        </p>
      </div>
    </footer>
  )
}
