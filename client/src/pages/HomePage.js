import { useEffect, useState } from 'react'
import { Container, Header, Divider, Icon } from 'semantic-ui-react'
import Mosaic from '../components/Mosiac';
import PageHeader from '../components/PageHeader';
import PageContainer from '../components/PageContainer';
import Loading from '../components/Loading';
import BotCard from '../components/BotCard';
const HomePage = () => {
  const [listLoading, setListLoading] = useState(true);
  const [list, setList] = useState(null);
  const getBotCards = () => {
    if (!list || list.length === undefined) return null;
    return list.map((bot, idx) => (
        <BotCard bot={bot} />
      )
    );
  }
  useEffect(() => {
    fetch("/init")
      .then((res) => res.json())
      .then((data) => {
        setList(data);
        setListLoading(false);
      })
      .catch(error => {
        setListLoading(false)
      })
  }, []);
  return (
    <PageContainer>
      <PageHeader>
          <h1>Generals Bots</h1>
          <Icon name="github" color="blue" size="huge" link={true} href="" />
      </PageHeader>
      <Container>
        <Header as="h2" style={{"paddingTop": "20px"}}>
          Explore Bots
        </Header>
        <Divider />
        {(listLoading) ? <Loading />:(
          <Mosaic>
            {getBotCards()}
          </Mosaic>
        )}
      </Container>
    </PageContainer>
  )
}
export default HomePage;