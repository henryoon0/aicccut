import type { StepMeta, StepModule } from "./types";

/**
 * Every process of the editor, in the order a user meets them. Each step has
 * its own folder under ./steps/<slug>/ with an index.ts exporting `variants`.
 */
export const STEPS: readonly StepMeta[] = [
  {
    slug: "projects-home",
    order: 1,
    title: "홈 · 프로젝트 목록",
    description: "앱을 열면 처음 보는 화면입니다. 최근 프로젝트를 보여주고 새 프로젝트를 시작합니다.",
    decision: "최근 작업을 어떻게 보여주고, 새 프로젝트로 어떻게 들어가게 할지.",
    theme: "dark",
  },
  {
    slug: "new-project",
    order: 2,
    title: "새 프로젝트 만들기",
    description: "이름, 화면 비율(16:9·9:16·1:1), 프레임레이트, 해상도를 정하는 흐름입니다.",
    decision: "설정을 한 화면에 다 보여줄지, 단계로 나눌지, 프리셋으로 건너뛰게 할지.",
    theme: "dark",
  },
  {
    slug: "editor-shell",
    order: 3,
    title: "편집기 레이아웃",
    description: "미디어·미리보기·속성·타임라인 4개 패널을 어떻게 배치하고 크기를 조절하는지 정합니다.",
    decision: "패널 배치의 기본형. 이 선택이 이후 모든 단계의 바탕이 됩니다.",
    theme: "dark",
  },
  {
    slug: "media-import",
    order: 4,
    title: "미디어 가져오기",
    description: "영상·오디오·이미지를 끌어놓기, 파일 선택, 붙여넣기로 가져오고 진행 상태를 보여줍니다.",
    decision: "빈 상태에서 첫 파일을 어떻게 받아들이고, 가져오는 중을 어떻게 보여줄지.",
    theme: "dark",
  },
  {
    slug: "media-library",
    order: 5,
    title: "미디어 라이브러리",
    description: "가져온 자산을 훑어보고 검색·정렬·필터하고, 타임라인으로 끌어가는 패널입니다.",
    decision: "격자형인지 목록형인지, 미리보기와 메타 정보를 얼마나 드러낼지.",
    theme: "dark",
  },
  {
    slug: "preview-transport",
    order: 6,
    title: "미리보기 · 재생 컨트롤",
    description: "캔버스, 재생/정지, 현재 시간, 배율, 안전 영역 가이드, 캔버스 위 직접 조작입니다.",
    decision: "컨트롤을 캔버스 위에 띄울지 아래에 둘지, 시간 표시와 배율을 어디에 둘지.",
    theme: "dark",
  },
  {
    slug: "timeline",
    order: 7,
    title: "타임라인",
    description: "트랙, 클립, 재생 헤드, 시간 눈금, 확대/축소, 스냅 표시입니다.",
    decision: "트랙 헤더의 정보량, 클립의 생김새, 눈금과 재생 헤드의 스타일.",
    theme: "dark",
  },
  {
    slug: "clip-editing",
    order: 8,
    title: "클립 편집 상호작용",
    description: "클립 선택, 트리밍 핸들, 분할, 리플 편집 모드, 우클릭 메뉴입니다.",
    decision: "트리밍·분할을 어떤 손맛으로 만들지. 핸들·커서·피드백의 방식.",
    theme: "dark",
  },
  {
    slug: "inspector",
    order: 9,
    title: "속성 패널",
    description: "변형(위치·크기·회전), 불투명도, 블렌드 모드, 타이포 섹션과 숫자 입력 스크러빙입니다.",
    decision: "섹션을 접는 방식, 숫자 입력의 형태, 패널의 밀도.",
    theme: "dark",
  },
  {
    slug: "text-tool",
    order: 10,
    title: "텍스트 도구",
    description: "텍스트 추가, 1,000종이 넘는 폰트 고르기, 크기·자간·행간·색 스타일링입니다.",
    decision: "폰트 선택기를 어떻게 만들지, 캔버스에서 바로 편집할지 패널에서 할지.",
    theme: "dark",
  },
  {
    slug: "keyframes-effects",
    order: 11,
    title: "키프레임 · 효과",
    description: "속성을 시간에 따라 움직이는 키프레임과 블러 같은 효과를 붙이는 방식입니다.",
    decision: "키프레임을 타임라인에 그릴지 별도 에디터로 뺄지, 효과를 어디서 붙일지.",
    theme: "dark",
  },
  {
    slug: "export",
    order: 12,
    title: "내보내기",
    description: "포맷·해상도·품질을 고르고, 렌더링 진행률을 보고, 끝나면 파일을 받습니다.",
    decision: "설정의 상세도, 진행 중 화면, 완료 후 다음 행동의 제안 방식.",
    theme: "dark",
  },
  {
    slug: "command-palette",
    order: 13,
    title: "명령 팔레트 · 단축키",
    description: "Cmd+K로 모든 명령을 검색하고, 단축키를 배우는 방식입니다.",
    decision: "팔레트의 정보 구조와 단축키를 어떻게 가르칠지.",
    theme: "dark",
  },
];

export function getStep(slug: string): StepMeta | undefined {
  return STEPS.find((s) => s.slug === slug);
}

const stepLoaders = import.meta.glob<StepModule>("./steps/*/index.ts");

export async function loadStepVariants(slug: string): Promise<StepModule | null> {
  const key = `./steps/${slug}/index.ts`;
  const loader = stepLoaders[key];
  if (!loader) return null;
  return loader();
}

export function hasStepModule(slug: string): boolean {
  return `./steps/${slug}/index.ts` in stepLoaders;
}
