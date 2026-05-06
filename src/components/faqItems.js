export const FAQ_ITEMS = {
  en: [
    {
      question: "What is this website?",
      answers: [
        "A timer, reader, place to buy books and a group chat rolled up into one website.",
      ],
    },
    {
      question: "Why add a timer?",
      answers: [
        "Helps you plan ahead.",
        "Helpful to grasp how efficient you actually are with your time.",
        "Avoid working long hours in one sitting. Any more than 2 hours of work at a time and your efficiency will generally drop.",
      ],
    },
    {
      question: "Why reading?",
      answers: [
        "In comparison to doomscrolling or video games, reading requires you to slow down and process information. Helps with attention span and an easier time easing back into working.",
      ],
    },
    {
      question: "Why limit the reading?",
      answers: [
        "Reading takes longer to really hook you in, but given time, it still can. This website prioritizes the work, not the reading.",
        "For comics and manga, every panel is carefully illustrated and cared for. Limiting makes you appreciate the details in the material instead of just reading for plot.",
      ],
    },
  ],
  vi: [
    {
      question: "Trang web này là gì?",
      answers: [
        "Một trang web tích hợp tất cả trong một: Bộ đếm giờ, trình đọc sách, nơi mua sách và cộng đồng trò chuyện.",
      ],
    },
    {
      question: "Tại sao cần bộ đếm giờ?",
      answers: [
        "Giúp bạn chủ động lập kế hoạch rõ ràng.",
        "Đánh giá hiệu suất thực tế.",
        "Tránh kiệt sức: Làm việc quá 2 tiếng liên tục sẽ khiến hiệu quả giảm đi đáng kể.",
      ],
    },
    {
      question: "Tại sao nên đọc sách?",
      answers: [
        "Khác với việc lướt web hay chơi điện tử, đọc sách rèn luyện tư duy sâu và khả năng xử lý thông tin. Nó giúp tăng cường sự tập trung, giúp bạn quay trở lại làm việc nhẹ nhàng và hiệu quả hơn.",
      ],
    },
    {
      question: "Tại sao cần giới hạn đọc sách?",
      answers: [
        "Để đảm bảo sự cân bằng: Trang web này đặt công việc làm trọng tâm. Dù đọc sách rất thú vị, chúng tôi không muốn bạn quá sa đà mà quên đi nhiệm vụ chính.",
        "Đối với truyện tranh và manga, mỗi khung hình đều được họa sĩ chăm chút và vẽ vô cùng tỉ mỉ. Việc giới hạn giúp bạn trân trọng những chi tiết nghệ thuật trong tác phẩm thay vì chỉ đọc lướt qua để theo dõi cốt truyện.",
      ],
    },
  ],
};

export function getFaqItems(language = "vi") {
  return FAQ_ITEMS[language] ?? FAQ_ITEMS.vi;
}
