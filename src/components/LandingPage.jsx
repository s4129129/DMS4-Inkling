import { useEffect, useRef, useState } from "react";
import landing1Image from "../assets/Landing/Landing1.png";
import landing2Image from "../assets/Landing/Landing2.png";
import landing22Image from "../assets/Landing/Landing2.2.png";
import landing3Image from "../assets/Landing/Landing3.png";
import landing31Image from "../assets/Landing/Landing 3.1.png";
import landing32Image from "../assets/Landing/Landing3.2.png";
import landing41Image from "../assets/Landing/Landing4.1.png";
import landing42Image from "../assets/Landing/Landing4.2.png";
import landing43Image from "../assets/Landing/Landing4.3.png";
import landing44Image from "../assets/Landing/Landing 4.4.png";
import landing5Image from "../assets/Landing/Landing 5.png";
import { getThemeLogoAsset } from "../themes/logoCatalog";

const STORE_NAV_LINKS = [
  { label: "1", sectionIndex: 1 },
  { label: "2", sectionIndex: 2 },
  { label: "3", sectionIndex: 3 },
  { label: "4", sectionIndex: 4 },
];

const LANDING_SECTIONS = [
  {
    title: ["Quy trình làm việc"],
    note: "Một trang web tích hợp quy trình làm việc bao gồm: chia nhỏ nhiệm vụ, quản lý thời gian và rèn luyện thói quen đọc sách thông qua cơ chế trò chơi hóa (gamification).",
    image: landing1Image,
  },
  {
    eyebrow: "01",
    title: ["Hỗ trợ làm việc"],
    note: "Tích hợp đồng hồ bấm giờ và lịch để theo dõi các phiên làm việc của bạn.",
    images: [landing22Image, landing2Image],
    flipImagesOnScroll: true,
  },
  {
    eyebrow: "02",
    title: ["Đọc và", "thư giản"],
    note: "Đọc tệp tin từ máy của bạn hoặc tìm kiếm sách trực tuyến với trình đọc web tích hợp sẵn.",
    images: [landing32Image, landing3Image, landing31Image],
    stepImagesOnScroll: true,
  },
  {
    eyebrow: "03",
    title: ["Cá nhân hóa", "trang web"],
    note: "Nhận thêm các giao diện, gói hoạt ảnh và nhiều phần quà khác để trang trí trang chủ của bạn.",
    images: [landing41Image, landing42Image, landing43Image, landing44Image],
    stepImagesOnScroll: true,
  },
  {
    eyebrow: "04",
    title: ["Kết nối với", "những người dùng khác"],
    note: "Tham gia hoặc thành lập cộng đồng theo sở thích cá nhân.",
    image: landing5Image,
  },
];

const SCROLL_SECTION_BREAKPOINT = 110;
const TOUCH_SECTION_BREAKPOINT = 58;
const SECTION_TURN_COOLDOWN_MS = 480;

function clampLandingProgress(value) {
  return Math.max(0, Math.min(LANDING_SECTIONS.length - 1, value));
}

function LandingHeroPanel({
  section,
  index,
  imageStep,
  isSigningIn,
  errorMessage,
  onGoogleSignIn,
}) {
  return (
    <section
      className="landing-store-hero landing-store-hero-panel"
      aria-label={section.title.join(" ")}
      style={{ "--section-index": index }}
    >
      <div className="landing-store-headline">
        {section.eyebrow ? <p>{section.eyebrow}</p> : null}
        <h1>
          {section.title.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </h1>
      </div>

      <aside className="landing-store-note">
        <p>{section.note}</p>
        <div className="landing-store-note-actions">
          <button
            type="button"
            className="landing-store-primary"
            onClick={onGoogleSignIn}
            disabled={isSigningIn}
          >
            Continue
          </button>
          <button
            type="button"
            className="landing-store-secondary"
            onClick={onGoogleSignIn}
            disabled={isSigningIn}
          >
            Sign in
          </button>
        </div>
        {index === 0 && errorMessage ? (
          <p className="error-text">{errorMessage}</p>
        ) : null}
      </aside>

      {section.image || section.images?.length ? (
        <figure
          id={index === 0 ? "landing-comics" : undefined}
          className={`landing-store-section-visual${
            section.images?.length > 1 ? " multi-image" : ""
          }${
            section.images?.length ? ` image-count-${section.images.length}` : ""
          } image-stack-step-${imageStep}`}
          aria-hidden="true"
        >
          {(section.images ?? [section.image]).map((imageSrc) => (
            <img
              key={imageSrc}
              src={imageSrc}
              alt=""
              loading={index === 0 ? "eager" : "lazy"}
            />
          ))}
        </figure>
      ) : null}
    </section>
  );
}

export default function LandingPage({
  isSigningIn,
  errorMessage,
  onGoogleSignIn,
}) {
  const landingLogoSrc = getThemeLogoAsset("default", "dark");
  const sectionFlowRef = useRef(null);
  const wheelDeltaRef = useRef(0);
  const lastSectionTurnRef = useRef(0);
  const touchYRef = useRef(null);
  const [sectionProgress, setSectionProgress] = useState(0);
  const [imageStepSections, setImageStepSections] = useState({});

  const jumpToSection = (sectionIndex) => {
    wheelDeltaRef.current = 0;
    touchYRef.current = null;
    lastSectionTurnRef.current = performance.now();
    setImageStepSections((current) => ({
      ...current,
      [sectionIndex]: 0,
    }));
    setSectionProgress(clampLandingProgress(sectionIndex));
  };

  useEffect(() => {
    const stage = sectionFlowRef.current;
    if (!stage) {
      return undefined;
    }

    const turnSection = (direction, ignoreCooldown = false) => {
      const now = performance.now();
      if (
        !ignoreCooldown &&
        now - lastSectionTurnRef.current < SECTION_TURN_COOLDOWN_MS
      ) {
        return;
      }

      let didTurn = false;
      setSectionProgress((current) => {
        const currentIndex = Math.round(current);
        const currentSection = LANDING_SECTIONS[currentIndex];
        const canStepImages = Boolean(
          currentSection?.flipImagesOnScroll ||
            currentSection?.stepImagesOnScroll,
        );
        const currentImageStep = Math.max(
          0,
          Number(imageStepSections[currentIndex] || 0),
        );
        const maxImageStep = Math.max(
          0,
          Number(currentSection?.images?.length || 1) - 1,
        );

        if (direction > 0 && canStepImages && currentImageStep < maxImageStep) {
          didTurn = true;
          setImageStepSections((steps) => ({
            ...steps,
            [currentIndex]: currentImageStep + 1,
          }));
          return current;
        }

        if (direction < 0 && canStepImages && currentImageStep > 0) {
          didTurn = true;
          setImageStepSections((steps) => ({
            ...steps,
            [currentIndex]: currentImageStep - 1,
          }));
          return current;
        }

        const next = clampLandingProgress(current + Math.sign(direction));
        didTurn = next !== current;
        return next;
      });

      if (didTurn) {
        lastSectionTurnRef.current = now;
      }
    };

    const onWheel = (event) => {
      event.preventDefault();
      const dominantDelta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      wheelDeltaRef.current += dominantDelta;

      if (Math.abs(wheelDeltaRef.current) < SCROLL_SECTION_BREAKPOINT) {
        return;
      }

      turnSection(wheelDeltaRef.current);
      wheelDeltaRef.current = 0;
    };

    const onTouchStart = (event) => {
      touchYRef.current = event.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (event) => {
      if (touchYRef.current === null) {
        return;
      }
      event.preventDefault();
      const nextY = event.touches[0]?.clientY ?? touchYRef.current;
      const delta = touchYRef.current - nextY;
      if (Math.abs(delta) < TOUCH_SECTION_BREAKPOINT) {
        return;
      }

      turnSection(delta);
      touchYRef.current = nextY;
    };

    const onKeyDown = (event) => {
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        turnSection(1, true);
      }
      if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        turnSection(-1, true);
      }
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("touchstart", onTouchStart, { passive: true });
    stage.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [imageStepSections]);

  const activeSectionIndex = Math.round(sectionProgress);

  return (
    <section
      id="landing-home"
      className="landing-shell landing-comic-store-shell"
      aria-label="Inkling landing page"
    >
      <header className="landing-store-nav">
        <a
          className="landing-store-brand"
          href="#landing-home"
          onClick={(event) => {
            event.preventDefault();
            jumpToSection(0);
          }}
        >
          <img src={landingLogoSrc} alt="" loading="eager" />
          <strong>Inkling</strong>
        </a>

        <nav className="landing-store-links" aria-label="Landing navigation">
          {STORE_NAV_LINKS.map((link) => (
            <button
              key={link.label}
              type="button"
              className={`landing-store-section-link${
                activeSectionIndex === link.sectionIndex ? " active" : ""
              }`}
              onClick={() => jumpToSection(link.sectionIndex)}
              aria-label={`Section ${link.label}`}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="landing-store-actions">
          <button
            type="button"
            className="landing-store-auth-btn"
            onClick={onGoogleSignIn}
            disabled={isSigningIn}
          >
            {isSigningIn ? "Signing in" : "Sign in"}
          </button>
        </div>
      </header>

      <section
        id="landing-work"
        className="landing-store-section-flow"
        aria-label="Platform sections"
        ref={sectionFlowRef}
        style={{ "--landing-section-progress": sectionProgress }}
      >
        <div className="landing-store-section-sticky">
          {LANDING_SECTIONS.map((section, index) => (
            <LandingHeroPanel
              key={section.title.join(" ")}
              section={section}
              index={index}
              imageStep={Number(imageStepSections[index] || 0)}
              isSigningIn={isSigningIn}
              errorMessage={errorMessage}
              onGoogleSignIn={onGoogleSignIn}
            />
          ))}
        </div>
      </section>

      <button
        type="button"
        className={`landing-store-scroll-cue${
          activeSectionIndex >= LANDING_SECTIONS.length - 1 ? " is-hidden" : ""
        }`}
        onClick={() => {
          const activeSection = LANDING_SECTIONS[activeSectionIndex];
          const currentImageStep = Math.max(
            0,
            Number(imageStepSections[activeSectionIndex] || 0),
          );
          const maxImageStep = Math.max(
            0,
            Number(activeSection?.images?.length || 1) - 1,
          );
          if (
            (activeSection?.flipImagesOnScroll ||
              activeSection?.stepImagesOnScroll) &&
            currentImageStep < maxImageStep
          ) {
            setImageStepSections((current) => ({
              ...current,
              [activeSectionIndex]: currentImageStep + 1,
            }));
            return;
          }

          jumpToSection(activeSectionIndex + 1);
        }}
        aria-label="Next section"
        title="Next"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m14.9 12-5.7-5.7 1.4-1.4 7.1 7.1-7.1 7.1-1.4-1.4 5.7-5.7z" />
        </svg>
      </button>
    </section>
  );
}
