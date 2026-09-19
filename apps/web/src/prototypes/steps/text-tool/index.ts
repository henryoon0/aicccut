import type { VariantDef } from "#/prototypes/types";
import { Browser } from "./browser";
import { Canvas } from "./canvas";
import { Minimal } from "./minimal";
import { Panel } from "./panel";
import { Presets } from "./presets";

export const variants: VariantDef[] = [
  {
    name: "Panel",
    axis: "모든 편집을 오른쪽 패널에 모으고, 캔버스는 결과만 보여줍니다.",
    when: "속성 패널에 익숙한 편집기 사용자가 정확한 값을 다룰 때.",
    cost: "시선이 캔버스와 패널 사이를 계속 오갑니다.",
    component: Panel,
  },
  {
    name: "Canvas",
    axis: "캔버스에서 직접 타이핑하고, 선택한 글자 위에 떠 있는 툴바로 스타일을 바꿉니다.",
    when: "자막 몇 줄을 빨리 얹고 위치까지 손으로 잡을 때.",
    cost: "자간·행간 같은 세부 값은 툴바에 자리가 없습니다.",
    component: Canvas,
  },
  {
    name: "Presets",
    axis: "타이틀·하단 자막 같은 역할별 프리셋 카드를 고르고, 세부 조정은 접어 둡니다.",
    when: "매번 같은 스타일을 반복하는 강의 영상 작업일 때.",
    cost: "프리셋 밖의 스타일을 만들려면 한 번 더 열어야 합니다.",
    component: Presets,
  },
  {
    name: "Browser",
    axis: "폰트 고르기를 전체 높이 브라우저로 키우고, 내 문장으로 1,000종을 훑습니다.",
    when: "폰트 선택이 영상의 인상을 좌우하는 표지·타이틀 작업일 때.",
    cost: "폰트 외의 스타일 조정은 한 줄로 밀려납니다.",
    component: Browser,
  },
  {
    name: "Minimal",
    axis: "캔버스 위 툴바 한 줄만 두고, 자간·행간은 More 메뉴로 숨깁니다.",
    when: "텍스트가 부차적이고 화면을 최대한 비워야 할 때.",
    cost: "폰트 목록이 짧은 셀렉트라 1,000종을 훑기엔 좁습니다.",
    component: Minimal,
  },
];
