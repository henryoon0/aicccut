import type { VariantDef } from "#/prototypes/types";
import { Gallery } from "./gallery";
import { Ledger } from "./ledger";
import { Focus } from "./focus";
import { Launcher } from "./launcher";
import { Journal } from "./journal";

export const variants: VariantDef[] = [
  {
    name: "Gallery",
    axis: "큰 썸네일 격자, 새 프로젝트도 첫 타일로 같은 격자에 놓는다.",
    when: "프로젝트를 이름보다 화면으로 기억할 때.",
    cost: "메타 정보는 호버해야 보이고, 프로젝트가 많아지면 스크롤이 길어진다.",
    component: Gallery,
  },
  {
    name: "Ledger",
    axis: "정렬 가능한 표로 정보를 먼저 보여준다. 썸네일은 4px 색 띠만 남긴다.",
    when: "프로젝트가 수십 개이고 fps·길이·클립 수로 찾을 때.",
    cost: "첫 화면이 스프레드시트처럼 보여 편집 도구의 설렘이 적다.",
    component: Ledger,
  },
  {
    name: "Focus",
    axis: "가장 최근 프로젝트 1개가 화면을 차지하고 나머지는 아래 띠로 밀린다.",
    when: "보통 한 프로젝트를 며칠씩 이어 편집할 때.",
    cost: "다른 프로젝트로 갈아타는 데 클릭이 1번 더 든다.",
    component: Focus,
  },
  {
    name: "Launcher",
    axis: "새 프로젝트 만들기가 주인공. 비율 프리셋을 실제 비례의 프레임으로 고른다.",
    when: "매번 새 영상을 짧게 만들고 끝내는 릴스형 작업 흐름일 때.",
    cost: "이어서 편집하는 흐름이 사이드바로 밀려 작아 보인다.",
    component: Launcher,
  },
  {
    name: "Journal",
    axis: "오늘·어제·이번 주·이전으로 날짜별 묶음, 세로 레일 위의 조용한 로그.",
    when: "'그거 언제 만들었지'로 프로젝트를 떠올릴 때.",
    cost: "화면이 조용해서 비율·썸네일 같은 시각 단서가 거의 없다.",
    component: Journal,
  },
];
