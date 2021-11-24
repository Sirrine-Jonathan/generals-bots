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
  display: flex;
  justify-content: space-between;
  background: #2a2a3a;
  padding: 20px;
  & h1 {
    color: white;
  }
`;