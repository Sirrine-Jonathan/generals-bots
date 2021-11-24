import styled from 'styled-components';

const PageHeader = ({children, ...props}) => {
  return (
    <StyledPageHeader {...props}>
      {children}
    </StyledPageHeader>
  )
}

export default PageHeader;

const StyledPageHeader = styled.div`
  background: #533535;
  padding: 20px;
  & h1 {
    color: white;
  }
`;