import svgPaths from "./svg-yyqq2j4b7d";

function Heading() {
  return (
    <div className="h-[48px] relative shrink-0 w-[350.365px]" data-name="Heading 1">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Bold',sans-serif] font-bold leading-[48px] left-0 not-italic text-[#f1f5f9] text-[32px] top-[-1px] whitespace-nowrap">My Schedule Manager</p>
      </div>
    </div>
  );
}

function Icon() {
  return (
    <div className="relative shrink-0 size-[18px]" data-name="Icon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 18">
        <g id="Icon">
          <path d={svgPaths.p358e9780} id="Vector" stroke="var(--stroke-0, #E2E8F0)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          <path d={svgPaths.p127ee080} id="Vector_2" stroke="var(--stroke-0, #E2E8F0)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          <path d="M9.75 4.5H15.75" id="Vector_3" stroke="var(--stroke-0, #E2E8F0)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          <path d="M9.75 9H15.75" id="Vector_4" stroke="var(--stroke-0, #E2E8F0)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          <path d="M9.75 13.5H15.75" id="Vector_5" stroke="var(--stroke-0, #E2E8F0)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </g>
      </svg>
    </div>
  );
}

function ScheduleManagerContent1() {
  return (
    <div className="h-[24px] relative shrink-0 w-[86.583px]" data-name="ScheduleManagerContent">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-[43.5px] not-italic text-[#e2e8f0] text-[16px] text-center top-[-1px] whitespace-nowrap">View Tasks</p>
      </div>
    </div>
  );
}

function Button() {
  return (
    <div className="bg-[#1d293d] h-[41.333px] relative rounded-[10px] shrink-0 w-[145.917px]" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#45556c] border-[0.667px] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center pl-[16.667px] pr-[0.667px] py-[0.667px] relative size-full">
        <Icon />
        <ScheduleManagerContent1 />
      </div>
    </div>
  );
}

function Container() {
  return (
    <div className="absolute content-stretch flex h-[48px] items-center justify-between left-0 top-0 w-[1198.667px]" data-name="Container">
      <Heading />
      <Button />
    </div>
  );
}

function Icon1() {
  return (
    <div className="h-[20px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[8.33%]" data-name="Vector">
        <div className="absolute inset-[-6.25%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18.75 18.75">
            <path d={svgPaths.pd51cdf0} id="Vector" stroke="var(--stroke-0, #51A2FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.08333" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-[41.67%] left-1/2 right-[33.33%] top-1/4" data-name="Vector">
        <div className="absolute inset-[-15.62%_-31.26%_-15.63%_-31.25%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 5.41689 8.75023">
            <path d={svgPaths.p3f1e4a80} id="Vector" stroke="var(--stroke-0, #51A2FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.08333" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function StatCard() {
  return (
    <div className="bg-[rgba(28,57,142,0.5)] relative rounded-[14px] shrink-0 size-[45.333px]" data-name="StatCard">
      <div aria-hidden="true" className="absolute border-[#193cb8] border-[0.667px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-[0.667px] pt-[12.667px] px-[12.667px] relative size-full">
        <Icon1 />
      </div>
    </div>
  );
}

function Container2() {
  return (
    <div className="h-[20px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#90a1b9] text-[14px] top-[0.33px] whitespace-nowrap">Free Hours</p>
    </div>
  );
}

function Container3() {
  return (
    <div className="h-[32px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Inter:Bold',sans-serif] font-bold leading-[32px] left-0 not-italic text-[#f1f5f9] text-[24px] top-[-0.67px] whitespace-nowrap">77</p>
    </div>
  );
}

function StatCard1() {
  return (
    <div className="h-[54px] relative shrink-0 w-[73.469px]" data-name="StatCard">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[2px] items-start relative size-full">
        <Container2 />
        <Container3 />
      </div>
    </div>
  );
}

function Container1() {
  return (
    <div className="absolute bg-[#1d293d] content-stretch flex gap-[16px] h-[87.333px] items-center left-0 pl-[16.667px] pr-[0.667px] py-[0.667px] rounded-[16px] top-0 w-[287.667px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#314158] border-[0.667px] border-solid inset-0 pointer-events-none rounded-[16px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]" />
      <StatCard />
      <StatCard1 />
    </div>
  );
}

function Icon2() {
  return (
    <div className="h-[20px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[8.32%_8.32%_8.35%_8.34%]" data-name="Vector">
        <div className="absolute inset-[-6.25%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18.75 18.75">
            <path d={svgPaths.p3fe2e540} id="Vector" stroke="var(--stroke-0, #05DF72)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.08333" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[16.67%_8.33%_41.67%_37.5%]" data-name="Vector">
        <div className="absolute inset-[-12.5%_-9.62%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12.9167 10.4167">
            <path d={svgPaths.p67b4200} id="Vector" stroke="var(--stroke-0, #05DF72)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.08333" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function StatCard2() {
  return (
    <div className="bg-[rgba(13,84,43,0.5)] relative rounded-[14px] shrink-0 size-[45.333px]" data-name="StatCard">
      <div aria-hidden="true" className="absolute border-[#016630] border-[0.667px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-[0.667px] pt-[12.667px] px-[12.667px] relative size-full">
        <Icon2 />
      </div>
    </div>
  );
}

function Container5() {
  return (
    <div className="h-[20px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#90a1b9] text-[14px] top-[0.33px] whitespace-nowrap">Events Completed</p>
    </div>
  );
}

function Container6() {
  return (
    <div className="h-[32px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Inter:Bold',sans-serif] font-bold leading-[32px] left-0 not-italic text-[#f1f5f9] text-[24px] top-[-0.67px] whitespace-nowrap">1</p>
    </div>
  );
}

function StatCard3() {
  return (
    <div className="h-[54px] relative shrink-0 w-[121.854px]" data-name="StatCard">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[2px] items-start relative size-full">
        <Container5 />
        <Container6 />
      </div>
    </div>
  );
}

function Container4() {
  return (
    <div className="absolute bg-[#1d293d] content-stretch flex gap-[16px] h-[87.333px] items-center left-[303.67px] pl-[16.667px] pr-[0.667px] py-[0.667px] rounded-[16px] top-0 w-[287.667px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#314158] border-[0.667px] border-solid inset-0 pointer-events-none rounded-[16px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]" />
      <StatCard2 />
      <StatCard3 />
    </div>
  );
}

function Icon3() {
  return (
    <div className="h-[20px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[20.83%_62.5%_54.17%_12.5%]" data-name="Vector">
        <div className="absolute inset-[-20.83%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 7.08333 7.08333">
            <path d={svgPaths.p3bcdfe00} id="Vector" stroke="var(--stroke-0, #FF8904)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.08333" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[62.5%_62.5%_20.83%_12.5%]" data-name="Vector">
        <div className="absolute inset-[-31.25%_-20.83%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 7.08333 5.41667">
            <path d={svgPaths.p3bfba440} id="Vector" stroke="var(--stroke-0, #FF8904)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.08333" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-3/4 left-[54.17%] right-[12.5%] top-1/4" data-name="Vector">
        <div className="absolute inset-[-1.04px_-15.63%_-1.04px_-15.62%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 8.75 2.08333">
            <path d="M1.04167 1.04167H7.70833" id="Vector" stroke="var(--stroke-0, #FF8904)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.08333" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-1/2 left-[54.17%] right-[12.5%] top-1/2" data-name="Vector">
        <div className="absolute inset-[-1.04px_-15.63%_-1.04px_-15.62%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 8.75 2.08333">
            <path d="M1.04167 1.04167H7.70833" id="Vector" stroke="var(--stroke-0, #FF8904)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.08333" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-1/4 left-[54.17%] right-[12.5%] top-3/4" data-name="Vector">
        <div className="absolute inset-[-1.04px_-15.63%_-1.04px_-15.62%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 8.75 2.08333">
            <path d="M1.04167 1.04167H7.70833" id="Vector" stroke="var(--stroke-0, #FF8904)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.08333" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function StatCard4() {
  return (
    <div className="bg-[rgba(126,42,12,0.5)] relative rounded-[14px] shrink-0 size-[45.333px]" data-name="StatCard">
      <div aria-hidden="true" className="absolute border-[#9f2d00] border-[0.667px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-[0.667px] pt-[12.667px] px-[12.667px] relative size-full">
        <Icon3 />
      </div>
    </div>
  );
}

function Container8() {
  return (
    <div className="h-[20px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#90a1b9] text-[14px] top-[0.33px] whitespace-nowrap">Tasks Remaining</p>
    </div>
  );
}

function Container9() {
  return (
    <div className="h-[32px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Inter:Bold',sans-serif] font-bold leading-[32px] left-0 not-italic text-[#f1f5f9] text-[24px] top-[-0.67px] whitespace-nowrap">3</p>
    </div>
  );
}

function StatCard5() {
  return (
    <div className="h-[54px] relative shrink-0 w-[112.771px]" data-name="StatCard">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[2px] items-start relative size-full">
        <Container8 />
        <Container9 />
      </div>
    </div>
  );
}

function Container7() {
  return (
    <div className="absolute bg-[#1d293d] content-stretch flex gap-[16px] h-[87.333px] items-center left-[607.33px] pl-[16.667px] pr-[0.667px] py-[0.667px] rounded-[16px] top-0 w-[287.667px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#314158] border-[0.667px] border-solid inset-0 pointer-events-none rounded-[16px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]" />
      <StatCard4 />
      <StatCard5 />
    </div>
  );
}

function Icon4() {
  return (
    <div className="h-[20px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[29.17%_8.33%]" data-name="Vector">
        <div className="absolute inset-[-12.5%_-6.25%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18.75 10.4167">
            <path d={svgPaths.p17b3d800} id="Vector" stroke="var(--stroke-0, #C27AFF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.08333" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[29.17%_8.33%_45.83%_66.67%]" data-name="Vector">
        <div className="absolute inset-[-20.83%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 7.08333 7.08333">
            <path d={svgPaths.p3cd21c80} id="Vector" stroke="var(--stroke-0, #C27AFF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.08333" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function StatCard6() {
  return (
    <div className="bg-[rgba(89,22,139,0.5)] relative rounded-[14px] shrink-0 size-[45.333px]" data-name="StatCard">
      <div aria-hidden="true" className="absolute border-[#6e11b0] border-[0.667px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-[0.667px] pt-[12.667px] px-[12.667px] relative size-full">
        <Icon4 />
      </div>
    </div>
  );
}

function Container11() {
  return (
    <div className="h-[20px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#90a1b9] text-[14px] top-[0.33px] whitespace-nowrap">Productivity Score</p>
    </div>
  );
}

function Container12() {
  return (
    <div className="h-[32px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Inter:Bold',sans-serif] font-bold leading-[32px] left-0 not-italic text-[#f1f5f9] text-[24px] top-[-0.67px] whitespace-nowrap">25%</p>
    </div>
  );
}

function StatCard7() {
  return (
    <div className="h-[54px] relative shrink-0 w-[123.396px]" data-name="StatCard">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[2px] items-start relative size-full">
        <Container11 />
        <Container12 />
      </div>
    </div>
  );
}

function Container10() {
  return (
    <div className="absolute bg-[#1d293d] content-stretch flex gap-[16px] h-[87.333px] items-center left-[911px] pl-[16.667px] pr-[0.667px] py-[0.667px] rounded-[16px] top-0 w-[287.667px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#314158] border-[0.667px] border-solid inset-0 pointer-events-none rounded-[16px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]" />
      <StatCard6 />
      <StatCard7 />
    </div>
  );
}

function WeeklyStats() {
  return (
    <div className="absolute h-[87.333px] left-0 top-[80px] w-[1198.667px]" data-name="WeeklyStats">
      <Container1 />
      <Container4 />
      <Container7 />
      <Container10 />
    </div>
  );
}

function Icon5() {
  return (
    <div className="relative shrink-0 size-[18px]" data-name="Icon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 18">
        <g id="Icon">
          <path d="M8.25 13.5H2.25" id="Vector" stroke="var(--stroke-0, #51A2FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.875" />
          <path d={svgPaths.p16eff100} id="Vector_2" stroke="var(--stroke-0, #51A2FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.875" />
          <path d="M12 9H2.25" id="Vector_3" stroke="var(--stroke-0, #51A2FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.875" />
          <path d="M12 4.5H2.25" id="Vector_4" stroke="var(--stroke-0, #51A2FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.875" />
        </g>
      </svg>
    </div>
  );
}

function ActionSection1() {
  return (
    <div className="h-[22.5px] relative shrink-0 w-[85.438px]" data-name="ActionSection">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[22.5px] left-[43px] not-italic text-[#f1f5f9] text-[15px] text-center top-[-1px] whitespace-nowrap">Create Task</p>
      </div>
    </div>
  );
}

function Button1() {
  return (
    <div className="absolute bg-[#314158] content-stretch flex gap-[10px] h-[48px] items-center left-[500.73px] pl-[24.667px] pr-[0.667px] py-[0.667px] rounded-[16px] top-0 w-[162.771px]" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#45556c] border-[0.667px] border-solid inset-0 pointer-events-none rounded-[16px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]" />
      <Icon5 />
      <ActionSection1 />
    </div>
  );
}

function Icon6() {
  return (
    <div className="relative shrink-0 size-[18px]" data-name="Icon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 18">
        <g clipPath="url(#clip0_113_957)" id="Icon">
          <path d={svgPaths.p3296cd80} id="Vector" stroke="var(--stroke-0, #90A1B9)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          <path d="M15 2.25V5.25" id="Vector_2" stroke="var(--stroke-0, #90A1B9)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          <path d="M16.5 3.75H13.5" id="Vector_3" stroke="var(--stroke-0, #90A1B9)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          <path d="M3 12.75V14.25" id="Vector_4" stroke="var(--stroke-0, #90A1B9)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          <path d="M3.75 13.5H2.25" id="Vector_5" stroke="var(--stroke-0, #90A1B9)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </g>
        <defs>
          <clipPath id="clip0_113_957">
            <rect fill="white" height="18" width="18" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function ActionSection2() {
  return (
    <div className="h-[22.5px] relative shrink-0 w-[126.521px]" data-name="ActionSection">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[22.5px] left-[63.5px] not-italic text-[#90a1b9] text-[15px] text-center top-[-1px] whitespace-nowrap">Custom Schedule</p>
      </div>
    </div>
  );
}

function Button2() {
  return (
    <div className="absolute content-stretch flex gap-[10px] h-[48px] items-center left-[679.5px] pl-[24px] rounded-[16px] top-0 w-[202.521px]" data-name="Button">
      <Icon6 />
      <ActionSection2 />
    </div>
  );
}

function Icon7() {
  return (
    <div className="relative shrink-0 size-[18px]" data-name="Icon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 18">
        <g id="Icon">
          <path d="M3.75 9H14.25" id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.875" />
          <path d="M9 3.75V14.25" id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.875" />
        </g>
      </svg>
    </div>
  );
}

function ActionSection3() {
  return (
    <div className="h-[22.5px] relative shrink-0 w-[92.083px]" data-name="ActionSection">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[22.5px] left-[46.5px] not-italic text-[15px] text-center text-white top-[-1px] whitespace-nowrap">Create Event</p>
      </div>
    </div>
  );
}

function Button3() {
  return (
    <div className="absolute bg-[#155dfc] content-stretch flex gap-[10px] h-[48px] items-center left-[316.65px] pl-[24px] rounded-[16px] shadow-[0px_4px_20px_0px_rgba(37,99,235,0.15)] top-0 w-[168.083px]" data-name="Button">
      <Icon7 />
      <ActionSection3 />
    </div>
  );
}

function ActionSection() {
  return (
    <div className="h-[48px] relative shrink-0 w-full" data-name="ActionSection">
      <Button1 />
      <Button2 />
      <Button3 />
    </div>
  );
}

function Button4() {
  return (
    <div className="absolute h-[40px] left-[6.67px] rounded-[14px] top-[6.67px] w-[127.26px]" data-name="Button">
      <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[21px] left-[64.5px] not-italic text-[#90a1b9] text-[14px] text-center top-[9px] whitespace-nowrap">My Schedule</p>
    </div>
  );
}

function Button5() {
  return (
    <div className="absolute h-[40px] left-[139.93px] rounded-[14px] top-[6.67px] w-[122.094px]" data-name="Button">
      <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[21px] left-[61px] not-italic text-[#90a1b9] text-[14px] text-center top-[9px] whitespace-nowrap">Focus Mode</p>
    </div>
  );
}

function Container14() {
  return <div className="absolute bg-[#314158] h-[40px] left-0 rounded-[14px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)] top-0 w-[139.583px]" data-name="Container" />;
}

function Container15() {
  return <div className="absolute bg-[#2b7fff] h-[2px] left-[8px] rounded-[22369600px] top-[38px] w-[123.583px]" data-name="Container" />;
}

function Button6() {
  return (
    <div className="absolute h-[40px] left-[268.02px] rounded-[14px] top-[6.67px] w-[139.583px]" data-name="Button">
      <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[21px] left-[70px] not-italic text-[#f1f5f9] text-[14px] text-center top-[9px] whitespace-nowrap">Daily Schedule</p>
      <Container14 />
      <Container15 />
    </div>
  );
}

function SegmentedControl() {
  return (
    <div className="bg-[#1d293d] h-[53.333px] relative rounded-[16px] shrink-0 w-[414.271px]" data-name="SegmentedControl">
      <div aria-hidden="true" className="absolute border-[#314158] border-[0.667px] border-solid inset-0 pointer-events-none rounded-[16px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Button4 />
        <Button5 />
        <Button6 />
      </div>
    </div>
  );
}

function ActionSection4() {
  return (
    <div className="h-[53.333px] relative shrink-0 w-full" data-name="ActionSection">
      <div className="flex flex-row justify-center size-full">
        <div className="content-stretch flex items-start justify-center relative size-full">
          <SegmentedControl />
        </div>
      </div>
    </div>
  );
}

function Container13() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[24px] h-[125.333px] items-start left-0 top-[191.33px] w-[1198.667px]" data-name="Container">
      <ActionSection />
      <ActionSection4 />
    </div>
  );
}

function Container17() {
  return (
    <div className="absolute border-[#314158] border-r-[0.667px] border-solid h-[60px] left-0 top-[84.67px] w-[80px]" data-name="Container">
      <p className="-translate-x-full absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-[68.17px] not-italic text-[#62748e] text-[14px] text-right top-[13px] whitespace-nowrap">7 AM</p>
    </div>
  );
}

function Container18() {
  return (
    <div className="absolute border-[#314158] border-r-[0.667px] border-solid h-[60px] left-0 top-[144.67px] w-[80px]" data-name="Container">
      <p className="-translate-x-full absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-[67.43px] not-italic text-[#62748e] text-[14px] text-right top-[13px] whitespace-nowrap">8 AM</p>
    </div>
  );
}

function Container19() {
  return (
    <div className="absolute border-[#314158] border-r-[0.667px] border-solid h-[94.667px] left-0 top-[204.67px] w-[80px]" data-name="Container">
      <p className="-translate-x-full absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-[67.41px] not-italic text-[#62748e] text-[14px] text-right top-[13px] whitespace-nowrap">9 AM</p>
    </div>
  );
}

function Container20() {
  return (
    <div className="absolute border-[#314158] border-r-[0.667px] border-solid h-[94.667px] left-0 top-[299.33px] w-[80px]" data-name="Container">
      <p className="-translate-x-full absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-[67.56px] not-italic text-[#62748e] text-[14px] text-right top-[13px] whitespace-nowrap">10 AM</p>
    </div>
  );
}

function Container21() {
  return (
    <div className="absolute border-[#314158] border-r-[0.667px] border-solid h-[60px] left-0 top-[394px] w-[80px]" data-name="Container">
      <p className="-translate-x-full absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-[67.7px] not-italic text-[#62748e] text-[14px] text-right top-[13px] whitespace-nowrap">11 AM</p>
    </div>
  );
}

function Container22() {
  return (
    <div className="absolute border-[#314158] border-r-[0.667px] border-solid h-[60px] left-0 top-[454px] w-[80px]" data-name="Container">
      <p className="-translate-x-full absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-[67.57px] not-italic text-[#62748e] text-[14px] text-right top-[13px] whitespace-nowrap">12 PM</p>
    </div>
  );
}

function Container23() {
  return (
    <div className="absolute border-[#314158] border-r-[0.667px] border-solid h-[184.667px] left-0 top-[514px] w-[80px]" data-name="Container">
      <p className="-translate-x-full absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-[68.1px] not-italic text-[#62748e] text-[14px] text-right top-[13px] whitespace-nowrap">1 PM</p>
    </div>
  );
}

function Container24() {
  return (
    <div className="absolute border-[#314158] border-r-[0.667px] border-solid h-[60px] left-0 top-[698.67px] w-[80px]" data-name="Container">
      <p className="-translate-x-full absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-[68.26px] not-italic text-[#62748e] text-[14px] text-right top-[13px] whitespace-nowrap">2 PM</p>
    </div>
  );
}

function Container25() {
  return (
    <div className="absolute border-[#314158] border-r-[0.667px] border-solid h-[124.667px] left-0 top-[758.67px] w-[80px]" data-name="Container">
      <p className="-translate-x-full absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-[68.16px] not-italic text-[#62748e] text-[14px] text-right top-[13px] whitespace-nowrap">3 PM</p>
    </div>
  );
}

function Container26() {
  return (
    <div className="absolute border-[#314158] border-r-[0.667px] border-solid h-[60px] left-0 top-[883.33px] w-[80px]" data-name="Container">
      <p className="-translate-x-full absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-[67.76px] not-italic text-[#62748e] text-[14px] text-right top-[13px] whitespace-nowrap">4 PM</p>
    </div>
  );
}

function Container27() {
  return (
    <div className="absolute border-[#314158] border-r-[0.667px] border-solid h-[60px] left-0 top-[943.33px] w-[80px]" data-name="Container">
      <p className="-translate-x-full absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-[67.5px] not-italic text-[#62748e] text-[14px] text-right top-[13px] whitespace-nowrap">5 PM</p>
    </div>
  );
}

function Container28() {
  return (
    <div className="absolute border-[#314158] border-r-[0.667px] border-solid h-[60px] left-0 top-[1003.33px] w-[80px]" data-name="Container">
      <p className="-translate-x-full absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-[68.13px] not-italic text-[#62748e] text-[14px] text-right top-[13px] whitespace-nowrap">6 PM</p>
    </div>
  );
}

function Container29() {
  return (
    <div className="absolute border-[#314158] border-r-[0.667px] border-solid h-[60px] left-0 top-[1063.33px] w-[80px]" data-name="Container">
      <p className="-translate-x-full absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-[67.88px] not-italic text-[#62748e] text-[14px] text-right top-[13px] whitespace-nowrap">7 PM</p>
    </div>
  );
}

function Container30() {
  return (
    <div className="absolute border-[#314158] border-r-[0.667px] border-solid h-[60px] left-0 top-[1123.33px] w-[80px]" data-name="Container">
      <p className="-translate-x-full absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-[68.15px] not-italic text-[#62748e] text-[14px] text-right top-[13px] whitespace-nowrap">8 PM</p>
    </div>
  );
}

function TimeSlot() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[80px] top-[84.67px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot1() {
  return <div className="absolute bg-[rgba(22,36,86,0.3)] border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[239.61px] top-[84.67px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot2() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[399.23px] top-[84.67px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot3() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[558.85px] top-[84.67px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot4() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[718.47px] top-[84.67px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot5() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[878.09px] top-[84.67px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot6() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[1037.71px] top-[84.67px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot7() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[80px] top-[144.67px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot8() {
  return <div className="absolute bg-[rgba(22,36,86,0.3)] border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[239.61px] top-[144.67px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot9() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[399.23px] top-[144.67px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot10() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[558.85px] top-[144.67px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot11() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[718.47px] top-[144.67px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot12() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[878.09px] top-[144.67px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot13() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[1037.71px] top-[144.67px] w-[159.625px]" data-name="TimeSlot" />;
}

function CalendarEvent() {
  return (
    <div className="h-[16px] overflow-clip relative shrink-0 w-full" data-name="CalendarEvent">
      <p className="absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[16px] left-0 not-italic text-[12px] text-white top-[0.67px] whitespace-nowrap">Advanced Calculus</p>
    </div>
  );
}

function CalendarEvent1() {
  return (
    <div className="h-[16px] opacity-90 relative shrink-0 w-full" data-name="CalendarEvent">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[12px] text-white top-[0.67px] whitespace-nowrap">9:00 AM - 10:30 AM</p>
    </div>
  );
}

function Container31() {
  return (
    <div className="bg-[#2b7fff] h-[82px] relative rounded-[10px] shrink-0 w-full" data-name="Container">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col gap-[2px] items-start pl-[12px] pr-[8px] pt-[8px] relative size-full">
          <CalendarEvent />
          <CalendarEvent1 />
        </div>
      </div>
      <div aria-hidden="true" className="absolute border-[#155dfc] border-l-4 border-solid inset-0 pointer-events-none rounded-[10px]" />
    </div>
  );
}

function TimeSlot14() {
  return (
    <div className="absolute content-stretch flex flex-col h-[94.667px] items-start left-[80px] pb-[0.667px] pl-[4px] pr-[4.667px] pt-[4px] top-[204.67px] w-[159.615px]" data-name="TimeSlot">
      <div aria-hidden="true" className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid inset-0 pointer-events-none" />
      <Container31 />
    </div>
  );
}

function TimeSlot15() {
  return <div className="absolute bg-[rgba(22,36,86,0.3)] border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[94.667px] left-[239.61px] top-[204.67px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot16() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[94.667px] left-[399.23px] top-[204.67px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot17() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[94.667px] left-[558.85px] top-[204.67px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot18() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[94.667px] left-[718.47px] top-[204.67px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot19() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[94.667px] left-[878.09px] top-[204.67px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot20() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[94.667px] left-[1037.71px] top-[204.67px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot21() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[94.667px] left-[80px] top-[299.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot22() {
  return <div className="absolute bg-[rgba(22,36,86,0.3)] border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[94.667px] left-[239.61px] top-[299.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot23() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[94.667px] left-[399.23px] top-[299.33px] w-[159.625px]" data-name="TimeSlot" />;
}

function CalendarEvent2() {
  return (
    <div className="h-[16px] overflow-clip relative shrink-0 w-full" data-name="CalendarEvent">
      <p className="absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[16px] left-0 not-italic text-[12px] text-white top-[0.67px] whitespace-nowrap">History Lecture</p>
    </div>
  );
}

function CalendarEvent3() {
  return (
    <div className="h-[16px] opacity-90 relative shrink-0 w-full" data-name="CalendarEvent">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[12px] text-white top-[0.67px] whitespace-nowrap">10:00 AM - 11:30 AM</p>
    </div>
  );
}

function Container32() {
  return (
    <div className="bg-[#2b7fff] h-[82px] relative rounded-[10px] shrink-0 w-full" data-name="Container">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col gap-[2px] items-start pl-[12px] pr-[8px] pt-[8px] relative size-full">
          <CalendarEvent2 />
          <CalendarEvent3 />
        </div>
      </div>
      <div aria-hidden="true" className="absolute border-[#155dfc] border-l-4 border-solid inset-0 pointer-events-none rounded-[10px]" />
    </div>
  );
}

function TimeSlot24() {
  return (
    <div className="absolute content-stretch flex flex-col h-[94.667px] items-start left-[558.85px] pb-[0.667px] pl-[4px] pr-[4.667px] pt-[4px] top-[299.33px] w-[159.615px]" data-name="TimeSlot">
      <div aria-hidden="true" className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid inset-0 pointer-events-none" />
      <Container32 />
    </div>
  );
}

function TimeSlot25() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[94.667px] left-[718.47px] top-[299.33px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot26() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[94.667px] left-[878.09px] top-[299.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot27() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[94.667px] left-[1037.71px] top-[299.33px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot28() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[80px] top-[394px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot29() {
  return <div className="absolute bg-[rgba(22,36,86,0.3)] border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[239.61px] top-[394px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot30() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[399.23px] top-[394px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot31() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[558.85px] top-[394px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot32() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[718.47px] top-[394px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot33() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[878.09px] top-[394px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot34() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[1037.71px] top-[394px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot35() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[80px] top-[454px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot36() {
  return <div className="absolute bg-[rgba(22,36,86,0.3)] border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[239.61px] top-[454px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot37() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[399.23px] top-[454px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot38() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[558.85px] top-[454px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot39() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[718.47px] top-[454px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot40() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[878.09px] top-[454px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot41() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[1037.71px] top-[454px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot42() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[184.667px] left-[80px] top-[514px] w-[159.615px]" data-name="TimeSlot" />;
}

function CalendarEvent4() {
  return (
    <div className="h-[16px] overflow-clip relative shrink-0 w-full" data-name="CalendarEvent">
      <p className="absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[16px] left-0 not-italic text-[12px] text-white top-[0.67px] whitespace-nowrap">Physics Lab</p>
    </div>
  );
}

function CalendarEvent5() {
  return (
    <div className="h-[16px] opacity-90 relative shrink-0 w-full" data-name="CalendarEvent">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[12px] text-white top-[0.67px] whitespace-nowrap">1:00 PM - 4:00 PM</p>
    </div>
  );
}

function Container33() {
  return (
    <div className="bg-[#00c950] h-[172px] relative rounded-[10px] shrink-0 w-full" data-name="Container">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col gap-[2px] items-start pl-[12px] pr-[8px] pt-[8px] relative size-full">
          <CalendarEvent4 />
          <CalendarEvent5 />
        </div>
      </div>
      <div aria-hidden="true" className="absolute border-[#00a63e] border-l-4 border-solid inset-0 pointer-events-none rounded-[10px]" />
    </div>
  );
}

function TimeSlot43() {
  return (
    <div className="absolute bg-[rgba(22,36,86,0.3)] content-stretch flex flex-col h-[184.667px] items-start left-[239.61px] pb-[0.667px] pl-[4px] pr-[4.667px] pt-[4px] top-[514px] w-[159.615px]" data-name="TimeSlot">
      <div aria-hidden="true" className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid inset-0 pointer-events-none" />
      <Container33 />
    </div>
  );
}

function TimeSlot44() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[184.667px] left-[399.23px] top-[514px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot45() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[184.667px] left-[558.85px] top-[514px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot46() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[184.667px] left-[718.47px] top-[514px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot47() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[184.667px] left-[878.09px] top-[514px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot48() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[184.667px] left-[1037.71px] top-[514px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot49() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[80px] top-[698.67px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot50() {
  return <div className="absolute bg-[rgba(22,36,86,0.3)] border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[239.61px] top-[698.67px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot51() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[399.23px] top-[698.67px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot52() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[558.85px] top-[698.67px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot53() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[718.47px] top-[698.67px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot54() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[878.09px] top-[698.67px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot55() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[1037.71px] top-[698.67px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot56() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[124.667px] left-[80px] top-[758.67px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot57() {
  return <div className="absolute bg-[rgba(22,36,86,0.3)] border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[124.667px] left-[239.61px] top-[758.67px] w-[159.615px]" data-name="TimeSlot" />;
}

function CalendarEvent6() {
  return (
    <div className="h-[16px] overflow-clip relative shrink-0 w-full" data-name="CalendarEvent">
      <p className="absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[16px] left-0 not-italic text-[12px] text-white top-[0.67px] whitespace-nowrap">Study Group</p>
    </div>
  );
}

function CalendarEvent7() {
  return (
    <div className="h-[16px] opacity-90 relative shrink-0 w-full" data-name="CalendarEvent">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[12px] text-white top-[0.67px] whitespace-nowrap">3:00 PM - 5:00 PM</p>
    </div>
  );
}

function Container34() {
  return (
    <div className="bg-[#ff6900] h-[112px] relative rounded-[10px] shrink-0 w-full" data-name="Container">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col gap-[2px] items-start pl-[12px] pr-[8px] pt-[8px] relative size-full">
          <CalendarEvent6 />
          <CalendarEvent7 />
        </div>
      </div>
      <div aria-hidden="true" className="absolute border-[#f54900] border-l-4 border-solid inset-0 pointer-events-none rounded-[10px]" />
    </div>
  );
}

function TimeSlot58() {
  return (
    <div className="absolute content-stretch flex flex-col h-[124.667px] items-start left-[399.23px] pb-[0.667px] pl-[4px] pr-[4.667px] pt-[4px] top-[758.67px] w-[159.625px]" data-name="TimeSlot">
      <div aria-hidden="true" className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid inset-0 pointer-events-none" />
      <Container34 />
    </div>
  );
}

function TimeSlot59() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[124.667px] left-[558.85px] top-[758.67px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot60() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[124.667px] left-[718.47px] top-[758.67px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot61() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[124.667px] left-[878.09px] top-[758.67px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot62() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[124.667px] left-[1037.71px] top-[758.67px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot63() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[80px] top-[883.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot64() {
  return <div className="absolute bg-[rgba(22,36,86,0.3)] border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[239.61px] top-[883.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot65() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[399.23px] top-[883.33px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot66() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[558.85px] top-[883.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot67() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[718.47px] top-[883.33px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot68() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[878.09px] top-[883.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot69() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[1037.71px] top-[883.33px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot70() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[80px] top-[943.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot71() {
  return <div className="absolute bg-[rgba(22,36,86,0.3)] border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[239.61px] top-[943.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot72() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[399.23px] top-[943.33px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot73() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[558.85px] top-[943.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot74() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[718.47px] top-[943.33px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot75() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[878.09px] top-[943.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot76() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[1037.71px] top-[943.33px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot77() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[80px] top-[1003.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot78() {
  return <div className="absolute bg-[rgba(22,36,86,0.3)] border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[239.61px] top-[1003.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot79() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[399.23px] top-[1003.33px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot80() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[558.85px] top-[1003.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot81() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[718.47px] top-[1003.33px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot82() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[878.09px] top-[1003.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot83() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[1037.71px] top-[1003.33px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot84() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[80px] top-[1063.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot85() {
  return <div className="absolute bg-[rgba(22,36,86,0.3)] border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[239.61px] top-[1063.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot86() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[399.23px] top-[1063.33px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot87() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[558.85px] top-[1063.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot88() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[718.47px] top-[1063.33px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot89() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[878.09px] top-[1063.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot90() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[1037.71px] top-[1063.33px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot91() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[80px] top-[1123.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot92() {
  return <div className="absolute bg-[rgba(22,36,86,0.3)] border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[239.61px] top-[1123.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot93() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[399.23px] top-[1123.33px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot94() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[558.85px] top-[1123.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot95() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[718.47px] top-[1123.33px] w-[159.625px]" data-name="TimeSlot" />;
}

function TimeSlot96() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[878.09px] top-[1123.33px] w-[159.615px]" data-name="TimeSlot" />;
}

function TimeSlot97() {
  return <div className="absolute border-[#314158] border-b-[0.667px] border-r-[0.667px] border-solid h-[60px] left-[1037.71px] top-[1123.33px] w-[159.625px]" data-name="TimeSlot" />;
}

function CalendarGrid() {
  return (
    <div className="absolute h-[1183.333px] left-0 top-0 w-[1197.333px]" data-name="CalendarGrid">
      <Container17 />
      <Container18 />
      <Container19 />
      <Container20 />
      <Container21 />
      <Container22 />
      <Container23 />
      <Container24 />
      <Container25 />
      <Container26 />
      <Container27 />
      <Container28 />
      <Container29 />
      <Container30 />
      <TimeSlot />
      <TimeSlot1 />
      <TimeSlot2 />
      <TimeSlot3 />
      <TimeSlot4 />
      <TimeSlot5 />
      <TimeSlot6 />
      <TimeSlot7 />
      <TimeSlot8 />
      <TimeSlot9 />
      <TimeSlot10 />
      <TimeSlot11 />
      <TimeSlot12 />
      <TimeSlot13 />
      <TimeSlot14 />
      <TimeSlot15 />
      <TimeSlot16 />
      <TimeSlot17 />
      <TimeSlot18 />
      <TimeSlot19 />
      <TimeSlot20 />
      <TimeSlot21 />
      <TimeSlot22 />
      <TimeSlot23 />
      <TimeSlot24 />
      <TimeSlot25 />
      <TimeSlot26 />
      <TimeSlot27 />
      <TimeSlot28 />
      <TimeSlot29 />
      <TimeSlot30 />
      <TimeSlot31 />
      <TimeSlot32 />
      <TimeSlot33 />
      <TimeSlot34 />
      <TimeSlot35 />
      <TimeSlot36 />
      <TimeSlot37 />
      <TimeSlot38 />
      <TimeSlot39 />
      <TimeSlot40 />
      <TimeSlot41 />
      <TimeSlot42 />
      <TimeSlot43 />
      <TimeSlot44 />
      <TimeSlot45 />
      <TimeSlot46 />
      <TimeSlot47 />
      <TimeSlot48 />
      <TimeSlot49 />
      <TimeSlot50 />
      <TimeSlot51 />
      <TimeSlot52 />
      <TimeSlot53 />
      <TimeSlot54 />
      <TimeSlot55 />
      <TimeSlot56 />
      <TimeSlot57 />
      <TimeSlot58 />
      <TimeSlot59 />
      <TimeSlot60 />
      <TimeSlot61 />
      <TimeSlot62 />
      <TimeSlot63 />
      <TimeSlot64 />
      <TimeSlot65 />
      <TimeSlot66 />
      <TimeSlot67 />
      <TimeSlot68 />
      <TimeSlot69 />
      <TimeSlot70 />
      <TimeSlot71 />
      <TimeSlot72 />
      <TimeSlot73 />
      <TimeSlot74 />
      <TimeSlot75 />
      <TimeSlot76 />
      <TimeSlot77 />
      <TimeSlot78 />
      <TimeSlot79 />
      <TimeSlot80 />
      <TimeSlot81 />
      <TimeSlot82 />
      <TimeSlot83 />
      <TimeSlot84 />
      <TimeSlot85 />
      <TimeSlot86 />
      <TimeSlot87 />
      <TimeSlot88 />
      <TimeSlot89 />
      <TimeSlot90 />
      <TimeSlot91 />
      <TimeSlot92 />
      <TimeSlot93 />
      <TimeSlot94 />
      <TimeSlot95 />
      <TimeSlot96 />
      <TimeSlot97 />
    </div>
  );
}

function CalendarGrid1() {
  return <div className="absolute bg-[#0f172b] border-[#314158] border-b-[0.667px] border-solid h-[84.667px] left-0 top-0 w-[80px]" data-name="CalendarGrid" />;
}

function Container35() {
  return (
    <div className="h-[20px] relative shrink-0 w-full" data-name="Container">
      <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-[63.98px] not-italic text-[#90a1b9] text-[14px] text-center top-[0.33px] whitespace-nowrap">Mon</p>
    </div>
  );
}

function Container36() {
  return (
    <div className="h-[28px] relative shrink-0 w-full" data-name="Container">
      <p className="-translate-x-1/2 absolute font-['Inter:Bold',sans-serif] font-bold leading-[28px] left-[63.31px] not-italic text-[#e2e8f0] text-[20px] text-center top-0 whitespace-nowrap">9</p>
    </div>
  );
}

function CalendarGrid2() {
  return (
    <div className="absolute bg-[#0f172b] content-stretch flex flex-col gap-[4px] h-[84.667px] items-start left-[80px] pb-[0.667px] pt-[16px] px-[16px] top-0 w-[159.615px]" data-name="CalendarGrid">
      <div aria-hidden="true" className="absolute border-[#314158] border-b-[0.667px] border-solid inset-0 pointer-events-none" />
      <Container35 />
      <Container36 />
    </div>
  );
}

function Container37() {
  return (
    <div className="h-[20px] relative shrink-0 w-full" data-name="Container">
      <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-[63.93px] not-italic text-[#90a1b9] text-[14px] text-center top-[0.33px] whitespace-nowrap">Tue</p>
    </div>
  );
}

function Container38() {
  return (
    <div className="h-[28px] relative shrink-0 w-full" data-name="Container">
      <p className="-translate-x-1/2 absolute font-['Inter:Bold',sans-serif] font-bold leading-[28px] left-[63.75px] not-italic text-[#51a2ff] text-[20px] text-center top-0 whitespace-nowrap">10</p>
    </div>
  );
}

function CalendarGrid3() {
  return (
    <div className="absolute bg-[#0f172b] content-stretch flex flex-col gap-[4px] h-[84.667px] items-start left-[239.61px] pb-[0.667px] pt-[16px] px-[16px] top-0 w-[159.615px]" data-name="CalendarGrid">
      <div aria-hidden="true" className="absolute border-[#314158] border-b-[0.667px] border-solid inset-0 pointer-events-none" />
      <Container37 />
      <Container38 />
    </div>
  );
}

function Container39() {
  return (
    <div className="h-[20px] relative shrink-0 w-full" data-name="Container">
      <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-[63.7px] not-italic text-[#90a1b9] text-[14px] text-center top-[0.33px] whitespace-nowrap">Wed</p>
    </div>
  );
}

function Container40() {
  return (
    <div className="h-[28px] relative shrink-0 w-full" data-name="Container">
      <p className="-translate-x-1/2 absolute font-['Inter:Bold',sans-serif] font-bold leading-[28px] left-[64.19px] not-italic text-[#e2e8f0] text-[20px] text-center top-0 whitespace-nowrap">11</p>
    </div>
  );
}

function CalendarGrid4() {
  return (
    <div className="absolute bg-[#0f172b] content-stretch flex flex-col gap-[4px] h-[84.667px] items-start left-[399.23px] pb-[0.667px] pt-[16px] px-[16px] top-0 w-[159.625px]" data-name="CalendarGrid">
      <div aria-hidden="true" className="absolute border-[#314158] border-b-[0.667px] border-solid inset-0 pointer-events-none" />
      <Container39 />
      <Container40 />
    </div>
  );
}

function Container41() {
  return (
    <div className="h-[20px] relative shrink-0 w-full" data-name="Container">
      <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-[63.81px] not-italic text-[#90a1b9] text-[14px] text-center top-[0.33px] whitespace-nowrap">Thu</p>
    </div>
  );
}

function Container42() {
  return (
    <div className="h-[28px] relative shrink-0 w-full" data-name="Container">
      <p className="-translate-x-1/2 absolute font-['Inter:Bold',sans-serif] font-bold leading-[28px] left-[64.69px] not-italic text-[#e2e8f0] text-[20px] text-center top-0 whitespace-nowrap">12</p>
    </div>
  );
}

function CalendarGrid5() {
  return (
    <div className="absolute bg-[#0f172b] content-stretch flex flex-col gap-[4px] h-[84.667px] items-start left-[558.85px] pb-[0.667px] pt-[16px] px-[16px] top-0 w-[159.615px]" data-name="CalendarGrid">
      <div aria-hidden="true" className="absolute border-[#314158] border-b-[0.667px] border-solid inset-0 pointer-events-none" />
      <Container41 />
      <Container42 />
    </div>
  );
}

function Container43() {
  return (
    <div className="h-[20px] relative shrink-0 w-full" data-name="Container">
      <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-[63.83px] not-italic text-[#90a1b9] text-[14px] text-center top-[0.33px] whitespace-nowrap">Fri</p>
    </div>
  );
}

function Container44() {
  return (
    <div className="h-[28px] relative shrink-0 w-full" data-name="Container">
      <p className="-translate-x-1/2 absolute font-['Inter:Bold',sans-serif] font-bold leading-[28px] left-[64.54px] not-italic text-[#e2e8f0] text-[20px] text-center top-0 whitespace-nowrap">13</p>
    </div>
  );
}

function CalendarGrid6() {
  return (
    <div className="absolute bg-[#0f172b] content-stretch flex flex-col gap-[4px] h-[84.667px] items-start left-[718.47px] pb-[0.667px] pt-[16px] px-[16px] top-0 w-[159.625px]" data-name="CalendarGrid">
      <div aria-hidden="true" className="absolute border-[#314158] border-b-[0.667px] border-solid inset-0 pointer-events-none" />
      <Container43 />
      <Container44 />
    </div>
  );
}

function Container45() {
  return (
    <div className="h-[20px] relative shrink-0 w-full" data-name="Container">
      <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-[64.43px] not-italic text-[#90a1b9] text-[14px] text-center top-[0.33px] whitespace-nowrap">Sat</p>
    </div>
  );
}

function Container46() {
  return (
    <div className="h-[28px] relative shrink-0 w-full" data-name="Container">
      <p className="-translate-x-1/2 absolute font-['Inter:Bold',sans-serif] font-bold leading-[28px] left-[63.73px] not-italic text-[#e2e8f0] text-[20px] text-center top-0 whitespace-nowrap">14</p>
    </div>
  );
}

function CalendarGrid7() {
  return (
    <div className="absolute bg-[#0f172b] content-stretch flex flex-col gap-[4px] h-[84.667px] items-start left-[878.09px] pb-[0.667px] pt-[16px] px-[16px] top-0 w-[159.615px]" data-name="CalendarGrid">
      <div aria-hidden="true" className="absolute border-[#314158] border-b-[0.667px] border-solid inset-0 pointer-events-none" />
      <Container45 />
      <Container46 />
    </div>
  );
}

function Container47() {
  return (
    <div className="h-[20px] relative shrink-0 w-full" data-name="Container">
      <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-[63.86px] not-italic text-[#90a1b9] text-[14px] text-center top-[0.33px] whitespace-nowrap">Sun</p>
    </div>
  );
}

function Container48() {
  return (
    <div className="h-[28px] relative shrink-0 w-full" data-name="Container">
      <p className="-translate-x-1/2 absolute font-['Inter:Bold',sans-serif] font-bold leading-[28px] left-[64.77px] not-italic text-[#e2e8f0] text-[20px] text-center top-0 whitespace-nowrap">15</p>
    </div>
  );
}

function CalendarGrid8() {
  return (
    <div className="absolute bg-[#0f172b] content-stretch flex flex-col gap-[4px] h-[84.667px] items-start left-[1037.71px] pb-[0.667px] pt-[16px] px-[16px] top-0 w-[159.625px]" data-name="CalendarGrid">
      <div aria-hidden="true" className="absolute border-[#314158] border-b-[0.667px] border-solid inset-0 pointer-events-none" />
      <Container47 />
      <Container48 />
    </div>
  );
}

function Container16() {
  return (
    <div className="absolute bg-[#1d293d] border-[#314158] border-[0.667px] border-solid h-[1184.667px] left-0 overflow-clip rounded-[16px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)] top-[340.67px] w-[1198.667px]" data-name="Container">
      <CalendarGrid />
      <CalendarGrid1 />
      <CalendarGrid2 />
      <CalendarGrid3 />
      <CalendarGrid4 />
      <CalendarGrid5 />
      <CalendarGrid6 />
      <CalendarGrid7 />
      <CalendarGrid8 />
    </div>
  );
}

function ScheduleManagerContent() {
  return (
    <div className="bg-[#0f172b] h-[1525.333px] relative shrink-0 w-full" data-name="ScheduleManagerContent">
      <Container />
      <WeeklyStats />
      <Container13 />
      <Container16 />
    </div>
  );
}

function Body() {
  return (
    <div className="absolute bg-white content-stretch flex flex-col h-[585.333px] items-start left-0 pt-[32px] px-[32px] top-0 w-[1262.667px]" data-name="Body">
      <ScheduleManagerContent />
    </div>
  );
}

function Icon8() {
  return (
    <div className="h-[24px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute bottom-1/2 left-[20.83%] right-[20.83%] top-1/2" data-name="Vector">
        <div className="absolute inset-[-1.25px_-8.93%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.5 2.5">
            <path d="M1.25 1.25H15.25" id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-[20.83%] left-1/2 right-1/2 top-[20.83%]" data-name="Vector">
        <div className="absolute inset-[-8.93%_-1.25px]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2.5 16.5">
            <path d="M1.25 1.25V15.25" id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Container49() {
  return (
    <div className="relative shrink-0 size-[24px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Icon8 />
      </div>
    </div>
  );
}

function Button7() {
  return (
    <div className="absolute bg-[#155dfc] content-stretch flex items-center justify-center left-[1174.67px] rounded-[22369600px] shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)] size-[56px] top-[497.33px]" data-name="Button">
      <Container49 />
    </div>
  );
}

export default function InteractiveScheduleManagerDesign() {
  return (
    <div className="bg-white relative size-full" data-name="Interactive Schedule Manager Design">
      <Body />
      <Button7 />
    </div>
  );
}