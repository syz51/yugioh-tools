export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="page-wrap site-footer-inner">
        <p>&copy; {year} 游戏王工具</p>
        <p>上传 YDK 文件，补全卡片资料，并在同一页核对整副卡组。</p>
      </div>
    </footer>
  )
}
