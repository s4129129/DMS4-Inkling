import { useEffect } from "react";

const ATTRIBUTE_NAMES = ["aria-label", "title", "placeholder"];

const EXACT_TRANSLATIONS = new Map(
  Object.entries({
    Overview: "Tổng quan",
    Timers: "Bộ đếm giờ",
    Library: "Thư viện",
    Calendar: "Lịch",
    Marketplace: "Cửa hàng",
    Groups: "Nhóm",
    Settings: "Cài đặt",
    Support: "Hỗ trợ",
    Help: "Trợ giúp",
    Profile: "Hồ sơ",
    Menu: "Menu",
    Premium: "Cao cấp",
    Sponsored: "Tài trợ",
    Advertisement: "Quảng cáo",
    Dashboard: "Bảng điều khiển",
    "Inkling Reader Dashboard": "Bảng điều khiển Inkling Reader",
    "Upload local PDFs, run a timer, and unlock pages as rewards.":
      "Tải PDF từ máy, chạy bộ đếm giờ và mở khóa trang như phần thưởng.",
    "Timers & Unlock Ratio": "Bộ đếm giờ & Tỷ lệ mở khóa",
    "Timers and unlock ratio info": "Thông tin bộ đếm giờ và tỷ lệ mở khóa",
    "Create timers for focused sessions and set how many minutes are required to unlock each reading page.":
      "Tạo phiên làm việc tập trung và đặt số phút cần thiết để mở khóa mỗi trang đọc.",
    "What do you plan to do this session":
      "Bạn dự định làm gì trong phiên này",
    "Save Unlock Ratio": "Lưu tỷ lệ mở khóa",
    "focus session": "phiên tập trung",
    "Return to Focus Session": "Quay lại phiên tập trung",
    "Resume Focus Session": "Tiếp tục phiên tập trung",
    Resume: "Tiếp tục",
    Pause: "Tạm dừng",
    Cancel: "Hủy",
    Claim: "Nhận",
    "Finish a timer to unlock the pause, cancel, and claim controls.":
      "Hoàn thành bộ đếm giờ để mở khóa các nút tạm dừng, hủy và nhận.",
    "Local Books": "Sách trong máy",
    Upload: "Tải lên",
    Uploading: "Đang tải lên",
    Remove: "Xóa",
    Reader: "Trình đọc",
    "No local books": "Chưa có sách trong máy",
    "No official books": "Chưa có sách chính thức",
    "Save Landing Page": "Lưu trang bắt đầu",
    "Save Thumbnail": "Lưu ảnh bìa",
    "Open Reader": "Mở trình đọc",
    "Rendering page...": "Đang hiển thị trang...",
    Prev: "Trước",
    Next: "Sau",
    "Open File": "Mở tệp",
    "Page progress": "Tiến độ trang",
    "The landing page is your guaranteed restart point. Pages after it can stay locked until earned through reading time.":
      "Trang bắt đầu là điểm quay lại chắc chắn của bạn. Các trang phía sau có thể vẫn bị khóa cho đến khi bạn mở bằng thời gian đọc.",
    "Pick which page appears as this book card thumbnail.":
      "Chọn trang sẽ xuất hiện làm ảnh bìa cho thẻ sách này.",
    "If the embedded reader fails, use Open or Download below.":
      "Nếu trình đọc nhúng không hoạt động, hãy dùng Mở hoặc Tải xuống bên dưới.",
    "Continue reading": "Tiếp tục đọc",
    "Continue Reading": "Tiếp tục đọc",
    Continue: "Tiếp tục",
    "Open Library": "Mở thư viện",
    Timeline: "Dòng thời gian",
    "Weekly Pages Per Day": "Số trang mỗi ngày trong tuần",
    "Pages unlocked": "Trang đã mở khóa",
    "Book Progress": "Tiến độ sách",
    "No book progress data yet.": "Chưa có dữ liệu tiến độ sách.",
    "No weekly unlock data yet. Complete a timer and claim a reward to start tracking pages.":
      "Chưa có dữ liệu mở khóa trong tuần. Hoàn thành bộ đếm giờ và nhận thưởng để bắt đầu theo dõi số trang.",
    "24h Activity Snapshot": "Ảnh chụp hoạt động 24 giờ",
    "No activity data for today yet. Start a timer or claim rewards to build the timeline.":
      "Hôm nay chưa có dữ liệu hoạt động. Bắt đầu bộ đếm giờ hoặc nhận thưởng để tạo dòng thời gian.",
    "Timer events": "Sự kiện bộ đếm giờ",
    Pages: "Trang",
    "Dashboard Snapshot": "Tổng quan bảng điều khiển",
    "Favorite book": "Sách yêu thích",
    "Data summary": "Tóm tắt dữ liệu",
    "24h reading activity": "Hoạt động đọc 24 giờ",
    "Unlocked pages total": "Tổng trang đã mở khóa",
    "Pages unlocked today": "Trang mở khóa hôm nay",
    "Completed sessions": "Phiên đã hoàn thành",
    "Google Calendar": "Lịch Google",
    Connect: "Kết nối",
    Reconnect: "Kết nối lại",
    "Sync 24h Data": "Đồng bộ dữ liệu 24 giờ",
    "Syncing...": "Đang đồng bộ...",
    "Click any date to open Google Calendar.":
      "Nhấn vào ngày bất kỳ để mở Lịch Google.",
    "No recent reading yet. Open a Library book to start tracking progress.":
      "Chưa có lượt đọc gần đây. Mở một sách trong Thư viện để bắt đầu theo dõi tiến độ.",
    "General": "Chung",
    "Theme": "Giao diện",
    "Banner": "Ảnh bìa",
    "Settings overlay": "Bảng cài đặt",
    "Settings tabs": "Tab cài đặt",
    "Close settings": "Đóng cài đặt",
    "Pages for streak": "Số trang cho chuỗi ngày",
    Language: "Ngôn ngữ",
    "Tutorial language": "Ngôn ngữ hướng dẫn",
    Apply: "Áp dụng",
    Active: "Đang dùng",
    Locked: "Đã khóa",
    Owned: "Đã sở hữu",
    "In Use": "Đang dùng",
    "Apply Theme": "Áp dụng giao diện",
    "No owned themes found yet.": "Chưa có giao diện đã sở hữu.",
    "Open Marketplace": "Mở Cửa hàng",
    "Unlock this in Marketplace before uploading your own banner.":
      "Mở khóa tính năng này trong Cửa hàng trước khi tải ảnh bìa riêng.",
    "Upload PNG banner": "Tải ảnh bìa PNG",
    "No custom banner uploaded yet.": "Chưa tải ảnh bìa tùy chỉnh.",
    "Primary saturated color": "Màu chính bão hòa",
    "Secondary saturated color": "Màu phụ bão hòa",
    "Categories": "Danh mục",
    "Market categories": "Danh mục cửa hàng",
    "Store view switch": "Chuyển chế độ cửa hàng",
    "Official Books": "Sách chính thức",
    "No items": "Không có mục",
    "No books": "Không có sách",
    "Manage in Settings": "Quản lý trong Cài đặt",
    "Buy Theme": "Mua giao diện",
    "Open Settings": "Mở Cài đặt",
    "Buy Feature": "Mua tính năng",
    Buy: "Mua",
    "Need Ink": "Cần Ink",
    Free: "Miễn phí",
    Search: "Tìm kiếm",
    "Close preview": "Đóng xem trước",
    "All Books": "Tất cả sách",
    "Select dashboard section": "Chọn mục bảng điều khiển",
    "Dashboard section picker": "Bộ chọn mục bảng điều khiển",
    "Dashboard sections": "Các mục bảng điều khiển",
    "Sidebar quick actions": "Tác vụ nhanh thanh bên",
    "Open support": "Mở hỗ trợ",
    "Open settings": "Mở cài đặt",
    "Log out": "Đăng xuất",
    "Resize sidebar": "Đổi kích thước thanh bên",
    "Daily streak": "Chuỗi ngày",
    "Switch to light mode": "Chuyển sang chế độ sáng",
    "Switch to dark mode": "Chuyển sang chế độ tối",
    "Change avatar": "Đổi ảnh đại diện",
    "Edit display name": "Sửa tên hiển thị",
    "Double-click to edit display name": "Nhấn đúp để sửa tên hiển thị",
    "Open menu": "Mở menu",
    "Reading tabs": "Tab đọc sách",
    "Open dashboard": "Mở bảng điều khiển",
    "Open a book in the Library to create a reading tab.":
      "Mở một sách trong Thư viện để tạo tab đọc.",
    "Close quick actions": "Đóng tác vụ nhanh",
    Month: "Tháng",
    Week: "Tuần",
    View: "Chế độ xem",
    Panel: "Bảng",
    "Sessions today": "Phiên hôm nay",
    "Sessions": "Phiên",
    "Day": "Ngày",
    "Mini": "Nhỏ",
    Today: "Hôm nay",
    Details: "Chi tiết",
    "No sessions logged yet": "Chưa ghi nhận phiên nào",
    "Calendar info": "Thông tin lịch",
    "Calendar nav": "Điều hướng lịch",
    "Previous": "Trước",
    "Previous month": "Tháng trước",
    "Next month": "Tháng sau",
    "Previous mini month": "Tháng nhỏ trước",
    "Next mini month": "Tháng nhỏ sau",
    "Mini calendar nav": "Điều hướng lịch nhỏ",
    "Resize calendar rail": "Đổi kích thước thanh lịch",
    Done: "Xong",
    Close: "Đóng",
    "Close FAQ": "Đóng FAQ",
    "Close support": "Đóng hỗ trợ",
    "Start Tutorial": "Bắt đầu hướng dẫn",
    Tutorial: "Hướng dẫn",
    FAQ: "FAQ",
    "For more information or critique, you can contact me at":
      "Để biết thêm thông tin hoặc góp ý, bạn có thể liên hệ với tôi tại",
    "Inkling Pro": "Inkling Pro",
    "No ads": "Không quảng cáo",
    "Cloud sync": "Đồng bộ đám mây",
    "Premium themes": "Giao diện cao cấp",
    "Upgrade": "Nâng cấp",
    "/ month": "/ tháng",
    "Avatar picker": "Bộ chọn ảnh đại diện",
    "Select Avatar": "Chọn ảnh đại diện",
    "Edit Image": "Sửa ảnh",
    "Position avatar": "Vị trí ảnh đại diện",
    Zoom: "Thu phóng",
    Rotate: "Xoay",
    GIF: "GIF",
    "Recent Avatars": "Ảnh đại diện gần đây",
    DMs: "Tin nhắn",
    Messages: "Tin nhắn",
    Chats: "Đoạn chat",
    "Your Groups": "Nhóm của bạn",
    "No groups": "Chưa có nhóm",
    "No results": "Không có kết quả",
    "No chats": "Chưa có cuộc trò chuyện",
    "No chat selected": "Chưa chọn cuộc trò chuyện",
    "No messages": "Chưa có tin nhắn",
    "No files": "Chưa có tệp",
    "No shared attachments yet.": "Chưa có tệp đính kèm được chia sẻ.",
    "No members found for this group.": "Không tìm thấy thành viên trong nhóm này.",
    "No group selected": "Chưa chọn nhóm",
    "Create Group": "Tạo nhóm",
    "Create group": "Tạo nhóm",
    "Find groups": "Tìm nhóm",
    Create: "Tạo",
    Join: "Tham gia",
    Leave: "Rời",
    Save: "Lưu",
    Reply: "Trả lời",
    Edit: "Sửa",
    Delete: "Xóa",
    Message: "Nhắn tin",
    "View profile": "Xem hồ sơ",
    Block: "Chặn",
    Member: "Thành viên",
    "Loading profile...": "Đang tải hồ sơ...",
    "Profile unavailable.": "Không thể xem hồ sơ.",
    "Conversation tools": "Công cụ trò chuyện",
    "Group tools": "Công cụ nhóm",
    "Change role": "Đổi vai trò",
    Role: "Vai trò",
    Mute: "Tắt tiếng",
    Ban: "Cấm",
    Group: "Nhóm",
    "Group Details": "Chi tiết nhóm",
    "Weekly Progress": "Tiến độ tuần",
    "Remove attachment": "Xóa tệp đính kèm",
    "No email": "Không có email",
    User: "Người dùng",
    "Sign out": "Đăng xuất",
    "Close profile": "Đóng hồ sơ",
    "Ad break": "Giờ quảng cáo",
    "Timer complete": "Hoàn thành bộ đếm giờ",
    "Theme already owned.": "Bạn đã sở hữu giao diện này.",
    "Custom banner unlocked. Customizable in Settings.":
      "Đã mở khóa ảnh bìa tùy chỉnh. Có thể chỉnh trong Cài đặt.",
    "Mechanical Interaction Pack unlocked. Configure Pop Up or Sink Down in Settings.":
      "Đã mở khóa gói tương tác cơ học. Cấu hình Pop Up hoặc Sink Down trong Cài đặt.",
    "Already owned.": "Đã sở hữu.",
    "Book purchased.": "Đã mua sách.",
    "Buy first.": "Hãy mua trước.",
    "Could not create group.": "Không thể tạo nhóm.",
    "Unable to find group": "Không thể tìm thấy nhóm",
    "Could not leave group.": "Không thể rời nhóm.",
    "Unlock this feature in Marketplace first.":
      "Hãy mở khóa tính năng này trong Cửa hàng trước.",
    "Upload failed.": "Tải lên thất bại.",
    "Book removed.": "Đã xóa sách.",
    "Language updated.": "Đã cập nhật ngôn ngữ.",
    "Could not update language.": "Không thể cập nhật ngôn ngữ.",
    "Page render failed. Please try another page.":
      "Hiển thị trang thất bại. Vui lòng thử trang khác.",
    "Download failed": "Tải xuống thất bại",
    "Upload failed": "Tải lên thất bại",
    "External upload failed": "Tải lên bên ngoài thất bại",
    "Book upload failed. Confirm the file is a supported format and your Convex setup is healthy.":
      "Tải sách thất bại. Hãy kiểm tra định dạng tệp được hỗ trợ và cấu hình Convex.",
    "Canvas context unavailable": "Không thể dùng canvas",
    "Unsupported image type": "Định dạng ảnh không được hỗ trợ",
    "Image conversion failed": "Chuyển đổi ảnh thất bại",
    "Image decode failed": "Giải mã ảnh thất bại",
    "Image load failed": "Tải ảnh thất bại",
    "Image fetch failed": "Lấy ảnh thất bại",
    "Avatar render failed": "Hiển thị ảnh đại diện thất bại",
    "Sign-in failed. Check your Google Auth consent screen, authorized origins, and Convex callback setup.":
      "Đăng nhập thất bại. Hãy kiểm tra màn hình đồng ý Google Auth, nguồn được phép và callback Convex.",
    "Checking your session...": "Đang kiểm tra phiên đăng nhập...",
    "10MB max.": "Tối đa 10MB.",
    "Image only.": "Chỉ dùng hình ảnh.",
    "Local file limit reached (${LOCAL_BOOK_UPLOAD_LIMIT}).":
      "Đã đạt giới hạn tệp trong máy (${LOCAL_BOOK_UPLOAD_LIMIT}).",
    "Could not add official book.": "Không thể thêm sách chính thức.",
    "Official book already in your library.":
      "Sách chính thức này đã có trong thư viện của bạn.",
    "Added official book: ${officialBook.title}":
      "Đã thêm sách chính thức: ${officialBook.title}",
    "Importing official book...": "Đang nhập sách chính thức...",
    "Could not remove book.": "Không thể xóa sách.",
    "Could not claim reward yet.": "Chưa thể nhận thưởng.",
    "Reward claimed.": "Đã nhận thưởng.",
    "Group updated.": "Đã cập nhật nhóm.",
    "Member updated.": "Đã cập nhật thành viên.",
    "Member removed.": "Đã xóa thành viên.",
    "Update failed.": "Cập nhật thất bại.",
    "Custom banner updated.": "Đã cập nhật ảnh bìa tùy chỉnh.",
    "Custom banner removed.": "Đã xóa ảnh bìa tùy chỉnh.",
    "Could not upload custom banner.": "Không thể tải ảnh bìa tùy chỉnh.",
    "Could not remove custom banner.": "Không thể xóa ảnh bìa tùy chỉnh.",
    "Only PNG files are supported for this banner.":
      "Ảnh bìa này chỉ hỗ trợ tệp PNG.",
    "Icon updated.": "Đã cập nhật biểu tượng.",
    "Adjust unlock ratio": "Điều chỉnh tỷ lệ mở khóa",
    "Create your timer": "Tạo bộ đếm giờ của bạn",
    "Claim unlock rewards": "Nhận phần thưởng mở khóa",
    "Explore the Marketplace": "Khám phá Cửa hàng",
    "Upload a book": "Tải sách lên",
    "Goal": "Mục tiêu",
    "Minutes": "Phút",
    "Minutes needed per page unlock": "Số phút cần để mở khóa mỗi trang",
    "Daily quota": "Chỉ tiêu hằng ngày",
    "Default Interaction Pack is always available. Unlock Mechanical Interaction Pack to use Pop Up and Sink Down.":
      "Gói tương tác mặc định luôn có sẵn. Mở khóa Gói tương tác cơ học để dùng Pop Up và Sink Down.",
    "Light Mode": "Chế độ sáng",
    "Dark Mode": "Chế độ tối",
    "Default": "Mặc định",
    "Mono": "Đơn sắc",
    "Vintage": "Cổ điển",
    "Sample Button": "Nút mẫu",
    "Clear Banner": "Xóa ảnh bìa",
    "All Items": "Tất cả mục",
    "Themes": "Giao diện",
    "Utilities": "Tiện ích",
    "Featured": "Nổi bật",
    "Available": "Có sẵn",
    "Added": "Đã thêm",
    "Hover": "Di chuột",
    "Light": "Sáng",
    "Dark": "Tối",
    "Interaction Packs": "Gói tương tác",
    "Add a book": "Thêm sách",
    "Total pages unlocked": "Tổng trang đã mở khóa",
    "Sessions completed": "Phiên đã hoàn thành",
    "Total session time": "Tổng thời gian phiên",
    "No weekly unlock data yet. Complete a timer and claim a reward to populate this chart.":
      "Chưa có dữ liệu mở khóa trong tuần. Hoàn thành bộ đếm giờ và nhận thưởng để điền biểu đồ này.",
    "No activity data for today yet. Start a timer or claim rewards to populate this chart.":
      "Hôm nay chưa có dữ liệu hoạt động. Bắt đầu bộ đếm giờ hoặc nhận thưởng để điền biểu đồ này.",
    "Reset 24h Zoom": "Đặt lại thu phóng 24 giờ",
    "Book unlock distribution pie chart":
      "Biểu đồ tròn phân bổ mở khóa sách",
    "Weekly pages chart": "Biểu đồ trang theo tuần",
    "Mon": "Thứ 2",
    "Tue": "Thứ 3",
    "Wed": "Thứ 4",
    "Thu": "Thứ 5",
    "Fri": "Thứ 6",
    "Sat": "Thứ 7",
    "Sun": "CN",
    "24-hour activity chart": "Biểu đồ hoạt động 24 giờ",
    "Paused": "Đã tạm dừng",
    "Started": "Đã bắt đầu",
    "Removed": "Đã xóa",
    "No timer sessions reached the 1-minute minimum yet. Calendar sync will create events once a session lasts at least 1 minute.":
      "Chưa có phiên bộ đếm giờ nào đạt tối thiểu 1 phút. Đồng bộ lịch sẽ tạo sự kiện khi phiên kéo dài ít nhất 1 phút.",
    "Add VITE_GOOGLE_CLIENT_ID in your .env file to enable Google Calendar sync.":
      "Thêm VITE_GOOGLE_CLIENT_ID vào tệp .env để bật đồng bộ Lịch Google.",
    "Google Calendar connected. Auto sync is enabled.":
      "Đã kết nối Lịch Google. Tự động đồng bộ đã bật.",
    "Google Calendar remembered. Auto sync will keep timeline entries updated.":
      "Đã ghi nhớ Lịch Google. Tự động đồng bộ sẽ cập nhật các mục dòng thời gian.",
    "Calendar is connected and ready to receive your focus sessions.":
      "Lịch đã kết nối và sẵn sàng nhận các phiên tập trung của bạn.",
    "Connect Google Calendar to sync your reading sessions.":
      "Kết nối Lịch Google để đồng bộ các phiên đọc của bạn.",
    "Google Calendar credentials are missing for this workspace.":
      "Workspace này thiếu thông tin xác thực Lịch Google.",
    "Add and unlock pages from books to populate this card.":
      "Thêm và mở khóa trang từ sách để điền thẻ này.",
    "No recent reading yet. Open a Library book to start tracking this card.":
      "Chưa có lượt đọc gần đây. Mở một sách trong Thư viện để bắt đầu theo dõi thẻ này.",
    "Download File": "Tải tệp xuống",
    "Download": "Tải xuống",
    "Landing page": "Trang bắt đầu",
    "Thumbnail page": "Trang ảnh bìa",
    "Select or upload a book to begin reading.":
      "Chọn hoặc tải sách lên để bắt đầu đọc.",
    "This CBZ file has no readable image pages.":
      "Tệp CBZ này không có trang ảnh đọc được.",
    "Go to previous page": "Đi tới trang trước",
    "Go to next page": "Đi tới trang sau",
    "Attachments": "Tệp đính kèm",
    "Attach file": "Đính kèm tệp",
    "Files": "Tệp",
    "Members": "Thành viên",
    "Privacy": "Quyền riêng tư",
    "Public": "Công khai",
    "Private": "Riêng tư",
    "Invite code": "Mã mời",
    "Group name": "Tên nhóm",
    "Discover": "Khám phá",
    "Find DMs": "Tìm tin nhắn",
    "Started Chats": "Đoạn chat đã bắt đầu",
    "Info": "Thông tin",
    "Unavailable": "Không khả dụng",
    "Loading...": "Đang tải...",
    "Message deleted": "Tin nhắn đã bị xóa",
    "Edited": "Đã sửa",
    "Toggle": "Bật/tắt",
    "Account": "Tài khoản",
    "Billing (Soon)": "Thanh toán (sắp có)",
    "Security (Soon)": "Bảo mật (sắp có)",
    "Profile tabs": "Tab hồ sơ",
    "Placeholder profile window. Account preferences and security controls can be added here.":
      "Khung hồ sơ tạm thời. Có thể thêm tùy chọn tài khoản và kiểm soát bảo mật tại đây.",
    "Close billing": "Đóng thanh toán",
    "Current": "Hiện tại",
    "Reset": "Đặt lại",
    "Default Light": "Mặc định sáng",
    "Next section": "Mục tiếp theo",
    "Landing navigation": "Điều hướng trang giới thiệu",
    "Platform sections": "Các mục nền tảng",
    "Inkling landing page": "Trang giới thiệu Inkling",
    "Ink is used in the Marketplace to buy and unlock themes.":
      "Ink được dùng trong Cửa hàng để mua và mở khóa giao diện.",
    "Quills are premium currency earned from weekly group reading milestones.":
      "Quills là tiền cao cấp nhận được từ các cột mốc đọc hằng tuần của nhóm.",
    "Export": "Xuất",
    "Main": "Chính",
    "Support tabs": "Tab hỗ trợ",
    "Close member menu": "Đóng menu thành viên",
    "Open this date in Google Calendar": "Mở ngày này trong Lịch Google",
    "Unable to find group.": "Không thể tìm thấy nhóm.",
    "Sets the first page you can always start from, even when later pages are locked.":
      "Đặt trang đầu tiên mà bạn luôn có thể bắt đầu đọc, ngay cả khi các trang sau vẫn bị khóa.",
    "[PLACEHOLDER 2]": "[CHỖ TRỐNG 2]",
  }),
);

const FULL_MONTHS = {
  January: "1",
  February: "2",
  March: "3",
  April: "4",
  May: "5",
  June: "6",
  July: "7",
  August: "8",
  September: "9",
  October: "10",
  November: "11",
  December: "12",
};

const SHORT_MONTHS = {
  Jan: "1",
  Feb: "2",
  Mar: "3",
  Apr: "4",
  May: "5",
  Jun: "6",
  Jul: "7",
  Aug: "8",
  Sep: "9",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

function monthNumber(monthName) {
  const normalized = String(monthName || "").trim();
  const titleCase =
    normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  return FULL_MONTHS[titleCase] ?? SHORT_MONTHS[titleCase] ?? normalized;
}

const REGEX_TRANSLATIONS = [
  [
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})$/i,
    (_, month, day, year) => `${day} tháng ${monthNumber(month)}, ${year}`,
  ],
  [
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})$/i,
    (_, month, day, year) => `${day} tháng ${monthNumber(month)}, ${year}`,
  ],
  [
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[–-]\s*(\d{1,2}),\s+(\d{4})$/i,
    (_, month, startDay, endDay, year) =>
      `${startDay}-${endDay} tháng ${monthNumber(month)}, ${year}`,
  ],
  [
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s*[–-]\s*(\d{1,2}),\s+(\d{4})$/i,
    (_, month, startDay, endDay, year) =>
      `${startDay}-${endDay} tháng ${monthNumber(month)}, ${year}`,
  ],
  [
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[–-]\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})$/i,
    (_, startMonth, startDay, endMonth, endDay, year) =>
      `${startDay} tháng ${monthNumber(startMonth)} - ${endDay} tháng ${monthNumber(endMonth)}, ${year}`,
  ],
  [
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s*[–-]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})$/i,
    (_, startMonth, startDay, endMonth, endDay, year) =>
      `${startDay} tháng ${monthNumber(startMonth)} - ${endDay} tháng ${monthNumber(endMonth)}, ${year}`,
  ],
  [
    /\bJanuary\b/g,
    "Tháng 1",
  ],
  [
    /\bFebruary\b/g,
    "Tháng 2",
  ],
  [
    /\bMarch\b/g,
    "Tháng 3",
  ],
  [
    /\bApril\b/g,
    "Tháng 4",
  ],
  [
    /\bMay\b/g,
    "Tháng 5",
  ],
  [
    /\bJune\b/g,
    "Tháng 6",
  ],
  [
    /\bJuly\b/g,
    "Tháng 7",
  ],
  [
    /\bAugust\b/g,
    "Tháng 8",
  ],
  [
    /\bSeptember\b/g,
    "Tháng 9",
  ],
  [
    /\bOctober\b/g,
    "Tháng 10",
  ],
  [
    /\bNovember\b/g,
    "Tháng 11",
  ],
  [
    /\bDecember\b/g,
    "Tháng 12",
  ],
  [
    /\bJan\b/g,
    "Thg 1",
  ],
  [
    /\bFeb\b/g,
    "Thg 2",
  ],
  [
    /\bMar\b/g,
    "Thg 3",
  ],
  [
    /\bApr\b/g,
    "Thg 4",
  ],
  [
    /\bJun\b/g,
    "Thg 6",
  ],
  [
    /\bJul\b/g,
    "Thg 7",
  ],
  [
    /\bAug\b/g,
    "Thg 8",
  ],
  [
    /\bSep\b/g,
    "Thg 9",
  ],
  [
    /\bOct\b/g,
    "Thg 10",
  ],
  [
    /\bNov\b/g,
    "Thg 11",
  ],
  [
    /\bDec\b/g,
    "Thg 12",
  ],
  [/^(\d+)\s+Streak$/i, "$1 ngày liên tiếp"],
  [/^Page\s+(\d+)$/i, "Trang $1"],
  [/^Loading\s+(\d+)%$/i, "Đang tải $1%"],
  [/^Close\s+(.+)\s+tab$/i, "Đóng tab $1"],
  [/^(\d+)\s+members$/i, "$1 thành viên"],
  [/^(\d+)\/(\d+)\s+members$/i, "$1/$2 thành viên"],
  [/^Timer:\s+Reading session$/i, "Bộ đếm giờ: Phiên đọc"],
  [/^Timer label:\s+Reading session$/i, "Nhãn bộ đếm giờ: Phiên đọc"],
  [/^Timer events$/i, "Sự kiện bộ đếm giờ"],
  [/^(\d+)\s+today$/i, "$1 hôm nay"],
  [/^(\d+)\s+session(s?)\s+ready to sync today\.$/i, "$1 phiên sẵn sàng đồng bộ hôm nay."],
  [/^Synced\s+(\d+)\s+timer sessions to Google Calendar\.$/i, "Đã đồng bộ $1 phiên bộ đếm giờ lên Lịch Google."],
  [/^Section\s+(\d+)$/i, "Mục $1"],
  [/^Open\s+(.+)\s+in Google Calendar$/i, "Mở $1 trong Lịch Google"],
  [/^(.+)'s Overview$/i, "Tổng quan của $1"],
];

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT"]);
const originalText = new WeakMap();
const originalAttributes = new WeakMap();
const translatedTextChanges = new WeakSet();
const translatedAttributeChanges = new WeakMap();

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function preserveOuterWhitespace(original, translated) {
  const leading = String(original).match(/^\s*/)?.[0] ?? "";
  const trailing = String(original).match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

function translateValue(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const exact = EXACT_TRANSLATIONS.get(normalized);
  if (exact) {
    return exact;
  }

  for (const [pattern, replacement] of REGEX_TRANSLATIONS) {
    if (pattern.test(normalized)) {
      return normalized.replace(pattern, replacement);
    }
  }

  return null;
}

function getOriginalAttributeMap(element) {
  let map = originalAttributes.get(element);
  if (!map) {
    map = new Map();
    originalAttributes.set(element, map);
  }
  return map;
}

function markTranslatedAttributeChange(element, attributeName) {
  let attributes = translatedAttributeChanges.get(element);
  if (!attributes) {
    attributes = new Set();
    translatedAttributeChanges.set(element, attributes);
  }
  attributes.add(attributeName);
}

function translateTextNode(node, language) {
  const parent = node.parentElement;
  if (!parent || SKIP_TAGS.has(parent.tagName)) {
    return;
  }

  if (!originalText.has(node)) {
    originalText.set(node, node.nodeValue);
  }

  const source = originalText.get(node);
  if (language !== "vi") {
    if (node.nodeValue !== source) {
      translatedTextChanges.add(node);
      node.nodeValue = source;
    }
    return;
  }

  const translated = translateValue(source);
  if (translated) {
    translatedTextChanges.add(node);
    node.nodeValue = preserveOuterWhitespace(source, translated);
  }
}

function translateElementAttributes(element, language) {
  if (SKIP_TAGS.has(element.tagName)) {
    return;
  }

  const originals = getOriginalAttributeMap(element);
  for (const attributeName of ATTRIBUTE_NAMES) {
    if (!element.hasAttribute(attributeName)) {
      continue;
    }

    if (!originals.has(attributeName)) {
      originals.set(attributeName, element.getAttribute(attributeName));
    }

    const source = originals.get(attributeName);
    if (language !== "vi") {
      if (element.getAttribute(attributeName) !== source) {
        markTranslatedAttributeChange(element, attributeName);
        element.setAttribute(attributeName, source);
      }
      continue;
    }

    const translated = translateValue(source);
    if (translated) {
      markTranslatedAttributeChange(element, attributeName);
      element.setAttribute(attributeName, translated);
    }
  }
}

function translateTree(root, language) {
  if (!root) {
    return;
  }

  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root, language);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) {
    return;
  }

  if (root.nodeType === Node.ELEMENT_NODE) {
    translateElementAttributes(root, language);
  }

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
  );
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.TEXT_NODE) {
      translateTextNode(node, language);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      translateElementAttributes(node, language);
    }
  }
}

export function useVietnameseDomTranslation(language) {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    const root = document.getElementById("root") || document.body;
    let rafId = 0;

    const scheduleTranslate = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        translateTree(root, language);
      });
    };

    scheduleTranslate();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          if (translatedTextChanges.has(mutation.target)) {
            translatedTextChanges.delete(mutation.target);
            continue;
          }
          originalText.delete(mutation.target);
        }
        if (mutation.type === "attributes") {
          const translatedAttributes = translatedAttributeChanges.get(
            mutation.target,
          );
          if (translatedAttributes?.has(mutation.attributeName)) {
            translatedAttributes.delete(mutation.attributeName);
            continue;
          }
          const originals = originalAttributes.get(mutation.target);
          originals?.delete(mutation.attributeName);
        }
      }
      scheduleTranslate();
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ATTRIBUTE_NAMES,
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
      translateTree(root, "en");
    };
  }, [language]);
}
